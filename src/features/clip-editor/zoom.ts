/**
 * Zoom math for the clip editor (ADR 0011): keyframes in global game time and
 * crops in picture space, kept the way the edit document requires - keyframes
 * in play order at distinct times inside the clip window, crops inside the
 * picture and no deeper than {@link MIN_ZOOM_WIDTH}. A crop's height is the
 * same fraction of the picture as its width, so in picture space it is a
 * square and on screen it has the picture's shape. Pure, so the rules are
 * unit-tested without a DOM.
 */
import {
  type ClipEdit,
  EMPTY_EDIT,
  isEmptyEdit,
  MAX_ZOOM_KEYS,
  MIN_ZOOM_WIDTH,
  type TimeRange,
  type ZoomEase,
  type ZoomKey,
  type ZoomRect,
} from "@/features/clip-edits";
import type { PicturePoint } from "@/features/player/telestration/geometry";

/** The crop a new keyframe gets when the picture is not zoomed yet: 2x on the centre. */
export const DEFAULT_ZOOM: ZoomRect = { x: 0.25, y: 0.25, w: 0.5 };
/** How a new keyframe reaches the next one. */
export const DEFAULT_EASE: ZoomEase = "glide";

/** Times are kept to the millisecond, like the edit document. */
function toMs(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

/** Picture positions are kept to a ten-thousandth, like the edit document. */
function toStep(fraction: number): number {
  return Math.round(fraction * 10_000) / 10_000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** `rect` made valid: its width between the deepest zoom and none, inside the picture. */
export function clampRect(rect: ZoomRect): ZoomRect {
  const w = toStep(clamp(rect.w, MIN_ZOOM_WIDTH, 1));
  return {
    x: toStep(clamp(rect.x, 0, 1 - w)),
    y: toStep(clamp(rect.y, 0, 1 - w)),
    w,
  };
}

/** `rect` moved so its centre sits on `point`, as far as the picture allows. */
export function centreRectOn(rect: ZoomRect, point: PicturePoint): ZoomRect {
  return clampRect({
    x: point.x - rect.w / 2,
    y: point.y - rect.w / 2,
    w: rect.w,
  });
}

/** `rect` moved by `dx` and `dy` (picture fractions), as far as the picture allows. */
export function moveRect(rect: ZoomRect, dx: number, dy: number): ZoomRect {
  return clampRect({ x: rect.x + dx, y: rect.y + dy, w: rect.w });
}

/**
 * `rect` made `factor` times as wide around its centre: below 1 zooms in,
 * above 1 out.
 */
export function scaleRect(rect: ZoomRect, factor: number): ZoomRect {
  const w = clamp(rect.w * factor, MIN_ZOOM_WIDTH, 1);
  return clampRect({
    x: rect.x + (rect.w - w) / 2,
    y: rect.y + (rect.w - w) / 2,
    w,
  });
}

/**
 * The crop spanned from `anchor` to `point` (a corner held while dragging the
 * opposite one): as wide as the larger of the two spans, on `point`'s side of
 * `anchor`, and no wider than the picture leaves room for on that side.
 */
export function rectFromCorners(
  anchor: PicturePoint,
  point: PicturePoint,
): ZoomRect {
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const right = dx >= 0;
  const down = dy >= 0;
  const room = Math.min(
    right ? 1 - anchor.x : anchor.x,
    down ? 1 - anchor.y : anchor.y,
  );
  const w = clamp(
    Math.max(Math.abs(dx), Math.abs(dy)),
    MIN_ZOOM_WIDTH,
    Math.max(room, MIN_ZOOM_WIDTH),
  );
  return clampRect({
    x: right ? anchor.x : anchor.x - w,
    y: down ? anchor.y : anchor.y - w,
    w,
  });
}

/** The corner of `rect` opposite the one named, which stays put while that one is dragged. */
export function oppositeCorner(
  rect: ZoomRect,
  corner: { readonly right: boolean; readonly down: boolean },
): PicturePoint {
  return {
    x: corner.right ? rect.x : rect.x + rect.w,
    y: corner.down ? rect.y : rect.y + rect.w,
  };
}

/** Whether `rect` shows the whole picture. */
export function isFullPicture(rect: ZoomRect): boolean {
  return rect.w >= 1;
}

/** The keyframes with the one at `index` replaced. */
function replaceAt(
  keys: readonly ZoomKey[],
  index: number,
  key: ZoomKey,
): ZoomKey[] {
  return keys.map((current, at) => (at === index ? key : current));
}

/**
 * Add a keyframe with `rect` at `gameS` (kept inside the window), or select the
 * one already there. Returns the keyframes and the index of the one at that
 * time, or null when no more keyframes are allowed.
 */
export function addZoomKey(
  keys: readonly ZoomKey[],
  gameS: number,
  rect: ZoomRect,
  window: TimeRange,
): { zoom: ZoomKey[]; index: number } | null {
  const atS = toMs(clamp(gameS, window.startS, window.endS));
  const existing = keys.findIndex((key) => key.atS === atS);
  if (existing >= 0) return { zoom: [...keys], index: existing };
  if (keys.length >= MAX_ZOOM_KEYS) return null;
  const key: ZoomKey = { atS, rect: clampRect(rect), ease: DEFAULT_EASE };
  const zoom = [...keys, key].sort((a, b) => a.atS - b.atS);
  return { zoom, index: zoom.indexOf(key) };
}

/** The least time between two keyframes, in seconds. */
const KEY_GAP_S = 0.001;

/**
 * The keyframes with the one at `index` moved to `gameS`, kept inside the
 * window and between its neighbours, so keyframes never swap places.
 */
export function moveZoomKey(
  keys: readonly ZoomKey[],
  index: number,
  gameS: number,
  window: TimeRange,
): ZoomKey[] {
  const lowS = index > 0 ? keys[index - 1].atS + KEY_GAP_S : window.startS;
  const highS =
    index < keys.length - 1 ? keys[index + 1].atS - KEY_GAP_S : window.endS;
  const atS = toMs(clamp(gameS, lowS, highS));
  return keys.map((key, at) => (at === index ? { ...key, atS } : key));
}

/** The keyframes with the one at `index` showing `rect`. */
export function setZoomRect(
  keys: readonly ZoomKey[],
  index: number,
  rect: ZoomRect,
): ZoomKey[] {
  return replaceAt(keys, index, { ...keys[index], rect: clampRect(rect) });
}

/** The keyframes with the one at `index` reaching the next by `ease`. */
export function setZoomEase(
  keys: readonly ZoomKey[],
  index: number,
  ease: ZoomEase,
): ZoomKey[] {
  return replaceAt(keys, index, { ...keys[index], ease });
}

/** The keyframes without the one at `index`. */
export function removeZoomKey(
  keys: readonly ZoomKey[],
  index: number,
): ZoomKey[] {
  return keys.filter((_, at) => at !== index);
}

/** `edit` with `zoom` as its keyframes; an edit that then changes nothing is null. */
export function withZoom(
  edit: ClipEdit | null,
  zoom: readonly ZoomKey[],
): ClipEdit | null {
  const next: ClipEdit = { ...(edit ?? EMPTY_EDIT), zoom };
  return isEmptyEdit(next) ? null : next;
}
