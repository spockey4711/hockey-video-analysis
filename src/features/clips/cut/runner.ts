/**
 * The worker's loop: claim a clip, cut it, report the outcome, repeat.
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

import { planClipCut } from "@/features/clips/boundary";
import { resolveClipEnd } from "@/features/clips/cut/window";

/** Cuts a planned clip to `outputPath`; rejects when ffmpeg fails. */
export type ClipCutterFn = (
  plan: ReturnType<typeof planClipCut>,
  outputPath: string,
) => Promise<void>;

/** Everything the loop needs from the outside world. */
export interface ClipRunnerDeps {
  readonly queue: ClipQueue;
  readonly cut: ClipCutterFn;
  /**
   * Where a finished clip is written, relative to the media root, given its id.
   * The same relative path is stored on the row, so the app resolves it under
   * `MEDIA_BASE_URL` like any other media file.
   */
  readonly outputPathFor: (clipId: string) => string;
  /** Resolves a media-root-relative path to an absolute one for ffmpeg. */
  readonly resolveOutput: (relativePath: string) => string;
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
 * Returns true when the clip is `ready`, false when it was marked `failed`.
 * Planning errors (an empty game, a window past the last chapter) fail the clip
 * exactly like a cutter error - both mean this clip cannot be produced.
 */
export async function processClip(
  deps: ClipRunnerDeps,
  job: ClipJob,
): Promise<boolean> {
  const { queue, cut, outputPathFor, resolveOutput } = deps;
  const log = deps.log ?? consoleLog;
  const relativePath = outputPathFor(job.clipId);

  try {
    const endS = resolveClipEnd(job.startS, job.endS, job.tagType);
    const plan = planClipCut(job.sources, job.startS, endS);
    await cut(plan, resolveOutput(relativePath));
    await queue.markReady(job.clipId, relativePath);
    log.info(
      `clip ${job.clipId} ready: ${relativePath} ` +
        `(${plan.durationS.toFixed(3)}s${plan.spansBoundary ? ", spans a chapter seam" : ""})`,
    );
    return true;
  } catch (cause) {
    log.error(`clip ${job.clipId} failed to cut`, cause);
    await queue.markFailed(job.clipId);
    return false;
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
 * A non-empty queue is drained back-to-back; only an empty one sleeps, so a
 * freshly enqueued clip waits at most one poll interval. A queue error (the
 * database is down, say) propagates: the process exits and its restart policy
 * decides what happens next, rather than the worker spinning against a broken
 * connection.
 */
export async function runForever(
  deps: ClipRunnerDeps,
  { pollIntervalMs, signal, sleep = defaultSleep }: RunForeverOptions,
): Promise<void> {
  while (!signal?.aborted) {
    const claimed = await runOnce(deps);
    if (!claimed) {
      await sleep(pollIntervalMs, signal);
    }
  }
}
