/**
 * Public surface of the clips feature (P0-9). Enqueuing a clip inserts a
 * `pending` cut job the hockey-video-pipeline worker picks up through the shared
 * DB queue (ADR 0003); the queries read those jobs' status back for the coach.
 * The pure status helpers are exported for callers that classify a clip's
 * lifecycle without touching the database.
 */
export {
  enqueueClipForTag,
  listClipsByGame,
  listClipsByTag,
  type ClipRow,
  type ClipWithTag,
  type EnqueueResult,
} from "./queries";
export {
  CLIP_STATUSES,
  isActiveClipStatus,
  isClipStatus,
  type ClipStatus,
} from "./status";
export {
  parseClipEnqueueInput,
  isUuid,
  type ClipEnqueueInput,
} from "./validation";
