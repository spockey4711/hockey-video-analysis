/**
 * Public surface of clip edits (ADR 0011): how a collection entry trims, slows,
 * zooms and marks up its clip, stored as data and applied by the player at
 * playback. The edit document and its parser live in `edit`, the mapping onto
 * the clip file's clock and the per-frame evaluation in `playback`; both are
 * pure and safe for client code. The `server-only` queries are imported from
 * `./queries` directly by the route handler, so they never reach a client
 * bundle through this barrel.
 */
export {
  checkEditWindow,
  CLIP_EDIT_VERSION,
  EMPTY_EDIT,
  FULL_PICTURE,
  isEmptyEdit,
  MAX_EDIT_JSON_LENGTH,
  MAX_HOLD_S,
  MAX_MARKS,
  MAX_SLOW_RANGES,
  MAX_STROKE_POINTS,
  MAX_ZOOM_KEYS,
  MIN_HOLD_S,
  MIN_TRIM_S,
  MIN_ZOOM_WIDTH,
  parseClipEdit,
  parseSaveEditInput,
  SLOW_RATES,
  ZOOM_EASES,
  type ClipEdit,
  type ClipMark,
  type ParseResult,
  type SaveEditInput,
  type SlowRange,
  type SlowRate,
  type TimeRange,
  type ZoomEase,
  type ZoomKey,
  type ZoomRect,
} from "./edit";
export {
  editStateAt,
  freezeCrossed,
  interpolateRect,
  toFileS,
  toGameS,
  toPlaybackPlan,
  zoomAt,
  type ClipTimeline,
  type EditState,
  type PlaybackPlan,
} from "./playback";
