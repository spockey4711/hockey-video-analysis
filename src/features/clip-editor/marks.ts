/**
 * Marker rules for the clip editor (ADR 0011, D6): markers in global game
 * time, kept the way the edit document requires - in play order, inside the
 * clip window, at most {@link MAX_MARKS}, with unique short ids and strokes
 * small enough to ship to every viewer. Pure, so the rules are unit-tested
 * without a DOM.
 */
import {
  type ClipEdit,
  type ClipMark,
  EMPTY_EDIT,
  isEmptyEdit,
  MAX_HOLD_S,
  MAX_MARKS,
  MAX_STROKE_POINTS,
  MIN_HOLD_S,
  type TimeRange,
} from "@/features/clip-edits";
import type { Stroke } from "@/features/player/telestration/state";

/** The hold times on offer, in seconds. */
export const HOLD_CHOICES_S: readonly number[] = [1, 2, 3, 5, 8];

/** How a marker shows: for how long, and whether the picture stands still meanwhile. */
export interface MarkSettings {
  readonly holdS: number;
  readonly freeze: boolean;
}

/** A new marker freezes the picture for a few seconds (D6). */
export const DEFAULT_MARK_SETTINGS: MarkSettings = { holdS: 3, freeze: true };

/** Tries at a random id before counting up instead. */
const ID_TRIES = 16;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Times are kept to the millisecond, like the edit document. */
function toMs(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

/** Picture positions are kept to a ten-thousandth, like the edit document. */
function toStep(fraction: number): number {
  return Math.round(clamp(fraction, 0, 1) * 10_000) / 10_000;
}

/** A short lowercase id no marker in `marks` has yet. */
export function newMarkId(
  marks: readonly ClipMark[],
  random: () => number = Math.random,
): string {
  const taken = new Set(marks.map((mark) => mark.id));
  for (let attempt = 0; attempt < ID_TRIES; attempt += 1) {
    const id = random().toString(36).slice(2, 10);
    if (/^[a-z0-9]{1,12}$/.test(id) && !taken.has(id)) return id;
  }
  let count = marks.length;
  while (taken.has(`m${count}`)) count += 1;
  return `m${count}`;
}

/**
 * `stroke` ready to store: points kept to a ten-thousandth, and a long
 * freehand line thinned out evenly to the most points a stroke may hold,
 * keeping both of its ends.
 */
export function compactStroke(stroke: Stroke): Stroke {
  let { points } = stroke;
  if (points.length > MAX_STROKE_POINTS) {
    const last = points.length - 1;
    const step = last / (MAX_STROKE_POINTS - 1);
    points = Array.from(
      { length: MAX_STROKE_POINTS },
      (_, index) => points[Math.round(index * step)],
    );
  }
  return {
    ...stroke,
    points: points.map((point) => ({ x: toStep(point.x), y: toStep(point.y) })),
  };
}

/**
 * The markers with `mark` added, or put in place of the one with its id; its
 * moment kept inside the window, its hold time in bounds and its strokes
 * compacted. Null when it is new and no more markers are allowed.
 */
export function putMark(
  marks: readonly ClipMark[],
  mark: ClipMark,
  window: TimeRange,
): ClipMark[] | null {
  const existing = marks.findIndex((current) => current.id === mark.id);
  if (existing < 0 && marks.length >= MAX_MARKS) return null;
  const kept: ClipMark = {
    ...mark,
    atS: toMs(clamp(mark.atS, window.startS, window.endS)),
    holdS: toMs(clamp(mark.holdS, MIN_HOLD_S, MAX_HOLD_S)),
    strokes: mark.strokes.map(compactStroke),
  };
  const next =
    existing < 0
      ? [...marks, kept]
      : marks.map((current, at) => (at === existing ? kept : current));
  // A stable sort keeps markers at the same moment in the coach's order.
  return next.sort((a, b) => a.atS - b.atS);
}

/** The markers with the one with `id` showing by `settings`. */
export function setMarkSettings(
  marks: readonly ClipMark[],
  id: string,
  settings: MarkSettings,
): ClipMark[] {
  return marks.map((mark) =>
    mark.id === id
      ? {
          ...mark,
          holdS: toMs(clamp(settings.holdS, MIN_HOLD_S, MAX_HOLD_S)),
          freeze: settings.freeze,
        }
      : mark,
  );
}

/** The markers without the one with `id`. */
export function removeMark(marks: readonly ClipMark[], id: string): ClipMark[] {
  return marks.filter((mark) => mark.id !== id);
}

/** `edit` with `marks` as its markers; an edit that then changes nothing is null. */
export function withMarks(
  edit: ClipEdit | null,
  marks: readonly ClipMark[],
): ClipEdit | null {
  const next: ClipEdit = { ...(edit ?? EMPTY_EDIT), marks };
  return isEmptyEdit(next) ? null : next;
}
