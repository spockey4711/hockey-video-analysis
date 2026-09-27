/**
 * Public surface of the clip cut worker (P0-5). The worker is a separate
 * long-running process, not part of the request path: it claims `pending` rows
 * from the `clips` queue, copy-cuts them with ffmpeg (ADR 0004), and writes
 * `ready`, the served path and where the file really starts (ADR 0011) back.
 * For `mac` games it checks and serves the clip files the Mac uploaded instead
 * (Mac plan S5).
 * Its composition root is `scripts/clip-worker.ts`; see ADR 0007 for why it
 * lives in this repo.
 */
export {
  buildConcatArgs,
  buildConcatList,
  buildCutArgs,
  ClipCutError,
  cutClip,
  formatOffset,
  type CutClipOptions,
} from "./ffmpeg";
export {
  createClipQueue,
  requeueStaleProcessing,
  type ClipJob,
  type ClipQueue,
  type UnprobedClip,
  type WorkerDatabase,
} from "./queue";
export {
  buildKeyframeArgs,
  buildStartTimeArgs,
  buildVideoStartArgs,
  ClipProbeError,
  CLIP_PROBE_TIMEOUT_MS,
  cutStartFrom,
  parseKeyframe,
  parseStartTime,
  parseVideoStart,
  probeCutStart,
  seekTimestamp,
  type ProbeCutStartOptions,
  type ProbedCutStart,
} from "./probe";
export {
  backfillOnce,
  processClip,
  runForever,
  runOnce,
  type ClipCutterFn,
  type CutStartProbeFn,
  type ClipRunnerDeps,
  type ClipRunnerLog,
  type RunForeverOptions,
} from "./runner";
export {
  buildUploadProbeArgs,
  checkClipUpload,
  CLIP_DURATION_TOLERANCE_S,
  ClipUploadError,
  parseUploadProbe,
  uploadProblem,
  type ClipUploadExpectation,
  type ProbedUpload,
} from "./upload-check";
export {
  createUploadQueue,
  type UploadJob,
  type UploadQueue,
  type UploadSweep,
} from "./upload-queue";
export {
  expectedUploadDuration,
  FINISHED_UPLOAD_RETAIN_MS,
  moveFile,
  processUpload,
  sweepUploads,
  uploadOnce,
  type ClipUploadCheckFn,
  type UploadRunnerDeps,
} from "./upload-runner";
export { resolveClipEnd, FALLBACK_CLIP_WINDOW_S } from "./window";
