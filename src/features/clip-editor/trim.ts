/**
 * Trim math for the clip editor (ADR 0011), in global game time. Shortening a
 * clip sets the entry's trim, inside the clip window; lengthening widens the
 * tag window itself (a re-cut, for every link) and moves the trim's edge out
 * with it. Pure, so the rules are unit-tested without a DOM.
 */
import {
  type ClipEdit,
  EMPTY_EDIT,
  isEmptyEdit,
  MIN_TRIM_S,
  type TimeRange,
} from "@/features/clip-edits";

/** Which end of a trim: the in point or the out point. */
export type TrimEdge = "in" | "out";

/** Which side of the clip window lengthening adds footage to. */
export type WindowSide = "before" | "after";

/** How far one lengthening press widens the clip window, in seconds. */
export const LENGTHEN_STEP_S = 2;

/** Times are kept to the millisecond, like the edit document. */
function toMs(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

/** The stretch the entry plays: its trim, or the whole window without one. */
export function trimOf(edit: ClipEdit | null, window: TimeRange): TimeRange {
  return edit?.trim ?? window;
}

/**
 * The trim with its `edge` moved to `gameS`, kept inside `window` and at least
 * {@link MIN_TRIM_S} long: an edge pushed into the other stops short of it.
 */
export function moveEdge(
  trim: TimeRange,
  window: TimeRange,
  edge: TrimEdge,
  gameS: number,
): TimeRange {
  if (edge === "in") {
    const limit = Math.min(trim.endS - MIN_TRIM_S, window.endS);
    const startS = Math.min(Math.max(gameS, window.startS), limit);
    return { startS: toMs(startS), endS: trim.endS };
  }
  const limit = Math.max(trim.startS + MIN_TRIM_S, window.startS);
  const endS = Math.max(Math.min(gameS, window.endS), limit);
  return { startS: trim.startS, endS: toMs(endS) };
}

/**
 * `edit` with `trim` as its trim. A trim covering the whole window is stored
 * as none, and an edit that then changes nothing as null, the plain clip.
 */
export function withTrim(
  edit: ClipEdit | null,
  trim: TimeRange | null,
  window: TimeRange,
): ClipEdit | null {
  const whole =
    trim !== null && trim.startS <= window.startS && trim.endS >= window.endS;
  const next: ClipEdit = { ...(edit ?? EMPTY_EDIT), trim: whole ? null : trim };
  return isEmptyEdit(next) ? null : next;
}

/**
 * The clip window widened by {@link LENGTHEN_STEP_S} on `side`, kept inside
 * the game (0 to `gameDurationS`, where a game without a known length has no
 * end), or null when that side cannot grow any further.
 */
export function lengthenWindow(
  window: TimeRange,
  side: WindowSide,
  gameDurationS: number,
): TimeRange | null {
  if (side === "before") {
    const startS = toMs(Math.max(window.startS - LENGTHEN_STEP_S, 0));
    return startS < window.startS ? { startS, endS: window.endS } : null;
  }
  const gameEndS = gameDurationS > 0 ? gameDurationS : Infinity;
  const endS = toMs(Math.min(window.endS + LENGTHEN_STEP_S, gameEndS));
  return endS > window.endS ? { startS: window.startS, endS } : null;
}

/**
 * The edit after the window grew on `side` to `window`: a trim's edge on that
 * side moves out to the new window edge, so the added footage plays on the
 * link. Without a trim the whole, longer window plays anyway.
 */
export function editAfterLengthening(
  edit: ClipEdit | null,
  window: TimeRange,
  side: WindowSide,
): ClipEdit | null {
  if (!edit?.trim) return edit;
  const trim =
    side === "before"
      ? { startS: window.startS, endS: edit.trim.endS }
      : { startS: edit.trim.startS, endS: window.endS };
  return withTrim(edit, trim, window);
}
