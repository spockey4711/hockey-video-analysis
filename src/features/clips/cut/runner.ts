/**
 * The worker's loop: claim a clip, cut it, report the outcome, repeat; while
 * the queue is idle, backfill where older clip files start.
 *
 * Everything the loop touches arrives through {@link ClipRunnerDeps}, so this
 * module holds no database, filesystem or clock of its own and is unit-tested
 * against fakes. The composition root (`scripts/clip-worker.ts`) supplies the
 * real queue and cutter.
 *
 * A failed cut is terminal for that clip: the row goes `failed`, which the coach
 * can re-enqueue from the game's clip board. The worker never retries by itself,
 * because the usual cause - a missing or unreadable chapter file - does not fix
 * itself, and a silent retry loop would hide it.
 */
import type { ClipJob, ClipQueue } from "./queue";

import { planClipCut, type ClipCutPlan } from "@/features/clips/boundary";
import { resolveClipEnd } from "@/features/clips/cut/window";

/** Cuts a planned clip to `outputPath`; rejects when ffmpeg fails. */
export type ClipCutterFn = (
  plan: ReturnType<typeof planClipCut>,
  outputPath: string,
) => Promise<void>;

/**
 * Finds the game time at file time 0 of the clip file at `outputPath` (an
 * absolute path), cut from `plan`; rejects when the probe fails. See
 * `probeCutStart`.
 */
export type CutStartProbeFn = (
  plan: ClipCutPlan,
  outputPath: string,
) => Promise<number>;

/** Everything the loop needs from the outside world. */
export interface ClipRunnerDeps {
  readonly queue: ClipQueue;
  readonly cut: ClipCutterFn;
  readonly probeCutStart: CutStartProbeFn;
  /**
   * Where a finished clip is written, relative to the media root, given its id.
   * The same relative path is stored on the row, so the app resolves it under
   * `MEDIA_BASE_URL` like any other media file. Must be fresh per cut: a clip
   * is cut again when its window is edited, and a new path keeps the old file
   * playing (and out of any cache) until the row switches over.
   */
  readonly outputPathFor: (clipId: string) => string;
  /** Resolves a media-root-relative path to an absolute one for ffmpeg. */
  readonly resolveOutput: (relativePath: string) => string;
  /**
   * Deletes a media-root-relative output file no row points at any more; a
   * missing file is not an error.
   */
  readonly removeOutput: (relativePath: string) => Promise<void>;
  readonly log?: ClipRunnerLog;
}

/** The runner's reporting surface; defaults to console. */
export interface ClipRunnerLog {
  info(message: string): void;
  error(message: string, cause?: unknown): void;
}

const consoleLog: ClipRunnerLog = {
  info: (message) => console.info(message),
  error: (message, cause) => console.error(message, cause ?? ""),
};

/**
 * Cut one claimed job and report it.
 *
 * Returns true when the clip is `ready`, false when it was marked `failed` or
 * its tag was edited mid-cut (the row is `pending` again and this cut is
 * dropped). Planning errors (an empty game, a window past the last chapter)
 * fail the clip exactly like a cutter error - both mean this clip cannot be
 * produced. A failed probe of where the file starts does not: the clip plays
 * fine without it, so it is stored as unknown and the idle-time backfill tries
 * again. A file an earlier cut left behind is removed once the row stops
 * pointing at it.
 */
export async function processClip(
  deps: ClipRunnerDeps,
  job: ClipJob,
): Promise<boolean> {
  const { queue, cut, outputPathFor, resolveOutput } = deps;
  const log = deps.log ?? consoleLog;
  const relativePath = outputPathFor(job.clipId);

  let plan: ReturnType<typeof planClipCut>;
  try {
    const endS = resolveClipEnd(job.startS, job.endS, job.tagType, job.windows);
    plan = planClipCut(job.sources, job.startS, endS);
    await cut(plan, resolveOutput(relativePath));
  } catch (cause) {
    log.error(`clip ${job.clipId} failed to cut`, cause);
    await discardOutput(deps, log, relativePath);
    if (await queue.markFailed(job.clipId)) {
      await discardOutput(deps, log, job.previousOutputPath);
    }
    return false;
  }

  let cutStartS: number | null = null;
  try {
    cutStartS = await deps.probeCutStart(plan, resolveOutput(relativePath));
  } catch (cause) {
    log.error(
      `clip ${job.clipId}: could not probe where its file starts`,
      cause,
    );
  }

  if (!(await queue.markReady(job.clipId, relativePath, cutStartS))) {
    log.info(`clip ${job.clipId} was edited while cutting; cutting it again`);
    await discardOutput(deps, log, relativePath);
    return false;
  }
  log.info(
    `clip ${job.clipId} ready: ${relativePath} ` +
      `(${plan.durationS.toFixed(3)}s${plan.spansBoundary ? ", spans a chapter seam" : ""}` +
      `${cutStartS === null ? "" : `, file starts ${(job.startS - cutStartS).toFixed(3)}s before the tag`})`,
  );
  if (job.previousOutputPath !== relativePath) {
    await discardOutput(deps, log, job.previousOutputPath);
  }
  return true;
}

/**
 * Best-effort removal of an output file no row points at. A leftover file only
 * costs disk space, so a failed delete is logged rather than failing the clip.
 */
async function discardOutput(
  deps: ClipRunnerDeps,
  log: ClipRunnerLog,
  relativePath: string | null,
): Promise<void> {
  if (relativePath === null) return;
  try {
    await deps.removeOutput(relativePath);
  } catch (cause) {
    log.error(`could not remove stale clip file ${relativePath}`, cause);
  }
}

/**
 * Claim and process at most one clip.
 *
 * Returns true when a clip was claimed (whatever its outcome), false when the
 * queue held nothing - the signal the loop backs off on.
 */
export async function runOnce(deps: ClipRunnerDeps): Promise<boolean> {
  const job = await deps.queue.claimNext();
  if (!job) return false;
  await processClip(deps, job);
  return true;
}

/**
 * Probe and record where one older ready clip's file starts (ADR 0011): the
 * probe-only backfill for clips cut before the worker recorded it, or whose
 * probe failed at cut time. It never re-cuts. A clip whose probe fails goes into
 * `skipped` and is not tried again until the worker restarts, so an unreadable
 * file cannot keep an idle worker busy.
 *
 * Returns true when a clip was taken (whatever its outcome), false when every
 * ready clip is probed.
 */
export async function backfillOnce(
  deps: ClipRunnerDeps,
  skipped: Set<string>,
): Promise<boolean> {
  const log = deps.log ?? consoleLog;
  const clip = await deps.queue.nextUnprobed([...skipped]);
  if (!clip) return false;

  try {
    const endS = resolveClipEnd(
      clip.startS,
      clip.endS,
      clip.tagType,
      clip.windows,
    );
    const plan = planClipCut(clip.sources, clip.startS, endS);
    const cutStartS = await deps.probeCutStart(
      plan,
      deps.resolveOutput(clip.outputPath),
    );
    if (
      await deps.queue.recordCutStart(clip.clipId, clip.outputPath, cutStartS)
    ) {
      log.info(
        `clip ${clip.clipId}: file starts ` +
          `${(clip.startS - cutStartS).toFixed(3)}s before the tag (backfilled)`,
      );
    }
  } catch (cause) {
    skipped.add(clip.clipId);
    log.error(
      `clip ${clip.clipId}: could not probe where its file starts; ` +
        "skipping it until the worker restarts",
      cause,
    );
  }
  return true;
}

/** Controls for the long-running loop. */
export interface RunForeverOptions {
  /** How long to sleep after finding an empty queue. */
  readonly pollIntervalMs: number;
  /** Aborted to stop the loop after the clip in flight finishes. */
  readonly signal?: AbortSignal;
  /** Sleep, injected so tests do not wait in real time. */
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Poll the queue until `signal` aborts.
 *
 * A non-empty queue is drained back-to-back. An empty one backfills the file
 * start of one older clip at a time (see {@link backfillOnce}), checking the
 * queue again in between, so a cut never waits behind the backfill; only when
 * both are done does the loop sleep, so a freshly enqueued clip waits at most
 * one probe or one poll interval. A queue error (the database is down, say)
 * propagates: the process exits and its restart policy decides what happens
 * next, rather than the worker spinning against a broken connection.
 */
export async function runForever(
  deps: ClipRunnerDeps,
  { pollIntervalMs, signal, sleep = defaultSleep }: RunForeverOptions,
): Promise<void> {
  const skipped = new Set<string>();
  while (!signal?.aborted) {
    if (await runOnce(deps)) continue;
    if (await backfillOnce(deps, skipped)) continue;
    await sleep(pollIntervalMs, signal);
  }
}
