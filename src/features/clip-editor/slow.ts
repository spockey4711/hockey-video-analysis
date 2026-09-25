/**
 * Slow-motion math for the clip editor (ADR 0011), in global game time. The
 * ranges stay in play order, inside the clip window and apart from each other,
 * as the edit document requires; a change that cannot keep that returns null
 * or stops short. Pure, so the rules are unit-tested without a DOM.
 */
import {
  type ClipEdit,
  EMPTY_EDIT,
  isEmptyEdit,
  MAX_SLOW_RANGES,
  type SlowRange,
  type SlowRate,
  type TimeRange,
} from "@/features/clip-edits";

/** The shortest slow-motion range, in seconds. */
export const MIN_SLOW_S = 0.2;
/** How long a range added at the playhead runs, in seconds. */
export const DEFAULT_SLOW_S = 2;
/** The rate a new range plays at. */
export const DEFAULT_SLOW_RATE: SlowRate = 0.5;

/** Which end of a range: its start or its end. */
export type RangeEdge = "start" | "end";

/** Times are kept to the millisecond, like the edit document. */
function toMs(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

/** The ranges with `index` changed to `range`, in play order. */
function replaceAt(
  slow: readonly SlowRange[],
  index: number,
  range: SlowRange,
): SlowRange[] {
  return slow.map((current, at) => (at === index ? range : current));
}

/**
 * The free stretch around `gameS`: from the end of the range before it (or the
 * window's start) to the start of the range after it (or the window's end),
 * skipping the range at `skip`. Null when `gameS` lies inside another range.
 */
function gapAround(
  slow: readonly SlowRange[],
  gameS: number,
  window: TimeRange,
  skip = -1,
): TimeRange | null {
  let startS = window.startS;
  let endS = window.endS;
  for (const [index, range] of slow.entries()) {
    if (index === skip) continue;
    if (gameS >= range.startS && gameS < range.endS) return null;
    if (range.endS <= gameS) startS = Math.max(startS, range.endS);
    if (range.startS > gameS) endS = Math.min(endS, range.startS);
  }
  return { startS, endS };
}

/**
 * Add a range from `fromS` towards `toS` (either way round) at the default
 * rate, cut short where it would run into another range or out of the window.
 * Returns the new ranges and the new range's index, or null when there is no
 * room for one there, or no more ranges are allowed.
 */
export function addSlowRange(
  slow: readonly SlowRange[],
  fromS: number,
  toS: number,
  window: TimeRange,
): { slow: SlowRange[]; index: number } | null {
  if (slow.length >= MAX_SLOW_RANGES) return null;
  const anchorS = Math.min(Math.max(fromS, window.startS), window.endS);
  const gap = gapAround(slow, anchorS, window);
  if (!gap) return null;
  const otherS = Math.min(Math.max(toS, gap.startS), gap.endS);
  let startS = toMs(Math.min(anchorS, otherS));
  let endS = toMs(Math.max(anchorS, otherS));
  if (endS - startS < MIN_SLOW_S) {
    // Too short a drag: grow it to the minimum, forwards where there is room.
    endS = toMs(Math.min(startS + MIN_SLOW_S, gap.endS));
    startS = toMs(Math.max(endS - MIN_SLOW_S, gap.startS));
    if (endS - startS < MIN_SLOW_S - 1e-9) return null;
  }
  const range: SlowRange = { startS, endS, rate: DEFAULT_SLOW_RATE };
  const next = [...slow, range].sort((a, b) => a.startS - b.startS);
  return { slow: next, index: next.indexOf(range) };
}

/**
 * The ranges with the `edge` of the one at `index` moved to `gameS`, stopping
 * at its neighbours, the window, and {@link MIN_SLOW_S} from its other edge.
 */
export function moveSlowEdge(
  slow: readonly SlowRange[],
  index: number,
  edge: RangeEdge,
  gameS: number,
  window: TimeRange,
): SlowRange[] {
  const range = slow[index];
  if (edge === "start") {
    const lowS = index > 0 ? slow[index - 1].endS : window.startS;
    const startS = Math.min(Math.max(gameS, lowS), range.endS - MIN_SLOW_S);
    return replaceAt(slow, index, { ...range, startS: toMs(startS) });
  }
  const highS = index < slow.length - 1 ? slow[index + 1].startS : window.endS;
  const endS = Math.max(Math.min(gameS, highS), range.startS + MIN_SLOW_S);
  return replaceAt(slow, index, { ...range, endS: toMs(endS) });
}

/** The ranges with the one at `index` playing at `rate`. */
export function setSlowRate(
  slow: readonly SlowRange[],
  index: number,
  rate: SlowRate,
): SlowRange[] {
  return replaceAt(slow, index, { ...slow[index], rate });
}

/** The ranges without the one at `index`. */
export function removeSlowRange(
  slow: readonly SlowRange[],
  index: number,
): SlowRange[] {
  return slow.filter((_, at) => at !== index);
}

/** The index of the range playing at `gameS`, or -1. */
export function slowRangeAt(slow: readonly SlowRange[], gameS: number): number {
  return slow.findIndex((range) => gameS >= range.startS && gameS < range.endS);
}

/** `edit` with `slow` as its slow-motion ranges; an edit that then changes nothing is null. */
export function withSlow(
  edit: ClipEdit | null,
  slow: readonly SlowRange[],
): ClipEdit | null {
  const next: ClipEdit = { ...(edit ?? EMPTY_EDIT), slow };
  return isEmptyEdit(next) ? null : next;
}
