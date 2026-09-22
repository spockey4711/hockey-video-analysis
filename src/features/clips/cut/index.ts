/**
 * Public surface of the clip cut worker (P0-5). The worker is a separate
 * long-running process, not part of the request path: it claims `pending` rows
 * from the `clips` queue, copy-cuts them with ffmpeg (ADR 0004), and writes
 * `ready` plus the served path back. Its composition root is
 * `scripts/clip-worker.ts`; see ADR 0007 for why it lives in this repo.
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
  type WorkerDatabase,
} from "./queue";
export {
  processClip,
  runForever,
  runOnce,
  type ClipCutterFn,
  type ClipRunnerDeps,
  type ClipRunnerLog,
  type RunForeverOptions,
} from "./runner";
export { resolveClipEnd, FALLBACK_CLIP_WINDOW_S } from "./window";
