/**
 * The clip worker's share of the Mac's uploads (Mac plan S5): check each
 * handed-off clip file, move it into the served clips and mark its clip
 * `ready`; and, while idle, sweep uploads no one will finish.
 *
 * Like the cut loop, everything arrives through {@link UploadRunnerDeps}, so
 * this module holds no database or clock of its own and is unit-tested
 * against fakes. A file that fails a check fails its clip, as a failed cut
 * does: the coach can queue the clip again, and the Mac then cuts it anew.
 */
import { rename, copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import type { ClipRunnerDeps, ClipRunnerLog } from "./runner";
import type { UploadJob, UploadQueue } from "./upload-queue";
import { resolveClipEnd } from "./window";

import { planClipCut } from "@/features/clips/boundary";
import {
  listStagedUploads,
  removeStagingFile,
  stagingFilePath,
} from "@/features/uploads/staging";

/** How long a finished upload's row is kept, so a retried hand-off finds it. */
export const FINISHED_UPLOAD_RETAIN_MS = 24 * 60 * 60 * 1000;

/** Checks a staged clip file against what it should be; rejects when not. */
export type ClipUploadCheckFn = (
  filePath: string,
  expected: { readonly sizeBytes: number; readonly durationS: number },
) => Promise<void>;

/** What the upload side of the worker needs besides the cut loop's deps. */
export interface UploadRunnerDeps {
  readonly queue: UploadQueue;
  /** The staging directory the web app writes uploads to. */
  readonly stagingRoot: string;
  readonly check: ClipUploadCheckFn;
  /** Moves a checked file to an absolute path in the served media. */
  readonly move: (from: string, to: string) => Promise<void>;
}

type SharedDeps = Pick<
  ClipRunnerDeps,
  "outputPathFor" | "resolveOutput" | "removeOutput" | "log"
>;

const consoleLog: ClipRunnerLog = {
  info: (message) => console.info(message),
  error: (message, cause) => console.error(message, cause ?? ""),
};

/**
 * How long the file of `job` must last: from where the Mac says it starts to
 * the end of the tag's cut plan, the same plan the Mac cuts by.
 */
export function expectedUploadDuration(job: UploadJob): number {
  const endS = resolveClipEnd(job.startS, job.endS, job.tagType, job.windows);
  const plan = planClipCut(job.sources, job.startS, endS);
  const leadS = job.startS - job.cutStartS;
  if (!Number.isFinite(leadS) || leadS < 0) {
    throw new RangeError(`file start ${job.cutStartS}s does not fit the tag`);
  }
  return leadS + plan.durationS;
}

/**
 * Check one handed-off upload and serve it, or refuse it. Returns true when
 * its clip is `ready`. The staged file is gone afterwards either way, and a
 * file the clip pointed at before is removed once nothing points at it.
 */
export async function processUpload(
  shared: SharedDeps,
  deps: UploadRunnerDeps,
  job: UploadJob,
): Promise<boolean> {
  const log = shared.log ?? consoleLog;
  const staged = stagingFilePath(deps.stagingRoot, job.uploadId);
  const relativePath = shared.outputPathFor(job.clipId);

  try {
    await deps.check(staged, {
      sizeBytes: job.sizeBytes,
      durationS: expectedUploadDuration(job),
    });
    await deps.move(staged, shared.resolveOutput(relativePath));
  } catch (cause) {
    log.error(`clip ${job.clipId}: refused its uploaded file`, cause);
    const previous = await deps.queue.refuse(job);
    await removeQuietly(log, `upload ${job.uploadId}`, () =>
      removeStagingFile(deps.stagingRoot, job.uploadId),
    );
    await removeQuietly(log, relativePath, () =>
      shared.removeOutput(relativePath),
    );
    if (previous) await discard(shared, log, previous);
    return false;
  }

  const previous = await deps.queue.finish(job, relativePath);
  if (previous === false) {
    log.info(`clip ${job.clipId}: its tag changed; dropped the uploaded file`);
    await discard(shared, log, relativePath);
    return false;
  }
  log.info(
    `clip ${job.clipId} ready: ${relativePath} (uploaded from the Mac, ` +
      `file starts ${(job.startS - job.cutStartS).toFixed(3)}s before the tag)`,
  );
  if (previous !== null && previous !== relativePath) {
    await discard(shared, log, previous);
  }
  return true;
}

/**
 * Process the oldest handed-off upload, if any. Returns true when there was
 * one (whatever its outcome), false when none waits.
 */
export async function uploadOnce(
  shared: SharedDeps,
  deps: UploadRunnerDeps,
): Promise<boolean> {
  const job = await deps.queue.nextSubmitted();
  if (!job) return false;
  await processUpload(shared, deps, job);
  return true;
}

/**
 * Remove expired and long-finished uploads, every staged file no live upload
 * owns (an abandoned, expired, superseded or deleted upload's), and put `mac`
 * clips back on the Mac's queue when no upload is left for them. The staging
 * directory is listed before the live uploads are read, so a file created in
 * between belongs to a row the read already sees.
 */
export async function sweepUploads(
  shared: SharedDeps,
  deps: UploadRunnerDeps,
  now: Date,
): Promise<void> {
  const log = shared.log ?? consoleLog;
  const staged = await listStagedUploads(deps.stagingRoot);
  const sweep = await deps.queue.sweep(now, FINISHED_UPLOAD_RETAIN_MS);
  const orphans = staged.filter((id) => !sweep.liveIds.has(id));
  for (const id of orphans) {
    await removeQuietly(log, `upload ${id}`, () =>
      removeStagingFile(deps.stagingRoot, id),
    );
  }
  if (sweep.removed + sweep.requeued + orphans.length > 0) {
    log.info(
      `swept uploads: ${sweep.removed} removed, ${orphans.length} staged ` +
        `file(s) deleted, ${sweep.requeued} clip(s) back on the Mac's queue`,
    );
  }
}

/**
 * Move a file, across filesystems too: a rename when the staging directory
 * shares the media disk (the setup the ops guide asks for), else a copy.
 */
export async function moveFile(from: string, to: string): Promise<void> {
  await mkdir(path.dirname(to), { recursive: true });
  try {
    await rename(from, to);
  } catch (cause) {
    if ((cause as { code?: unknown }).code !== "EXDEV") throw cause;
    await copyFile(from, to);
    await rm(from, { force: true });
  }
}

async function discard(
  shared: SharedDeps,
  log: ClipRunnerLog,
  relativePath: string,
): Promise<void> {
  await removeQuietly(log, relativePath, () =>
    shared.removeOutput(relativePath),
  );
}

/** A leftover file only costs disk space, so a failed delete is logged. */
async function removeQuietly(
  log: ClipRunnerLog,
  what: string,
  remove: () => Promise<void>,
): Promise<void> {
  try {
    await remove();
  } catch (cause) {
    log.error(`could not remove ${what}`, cause);
  }
}
