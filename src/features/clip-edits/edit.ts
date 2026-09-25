/**
 * The clip edit document (ADR 0011): how one collection entry trims, slows,
 * zooms and marks up its clip, stored as one versioned JSON value on the
 * `collection_clips` row and applied by the player at playback.
 *
 * Every time is global game time in seconds (ADR 0002), never clip-file time,
 * so an edit stays on the same moment when the clip is cut again into a new
 * file. Picture positions (zoom crops, marker strokes) are in picture space
 * from 0 to 1, like telestration, so they hold on every screen size.
 *
 * Every submitted or stored edit passes {@link parseClipEdit} first. It checks
 * the shape and the caps, drops nothing silently and rejects the whole
 * document on the first bad value. A write must also fit the clip's current
 * window ({@link checkEditWindow}); a read does not, so a stored edit survives
 * a later window change and is clamped at playback instead. A future version
 * adds its shape and an upgrade step here; nothing else reads the raw JSON.
 */
import type { PicturePoint } from "@/features/player/telestration/geometry";
import {
  DRAW_TOOLS,
  PEN_COLORS,
  STROKE_WIDTHS,
  type Stroke,
} from "@/features/player/telestration/state";

/** The edit format this code writes. */
export const CLIP_EDIT_VERSION = 1;

/** A stretch of game time, `startS` before `endS`. */
export interface TimeRange {
  readonly startS: number;
  readonly endS: number;
}

/** The slow-motion speeds on offer. Slow motion plays muted. */
export type SlowRate = 0.5 | 0.25;
export const SLOW_RATES: readonly SlowRate[] = [0.5, 0.25];

/** A stretch played in slow motion. */
export interface SlowRange extends TimeRange {
  readonly rate: SlowRate;
}

/**
 * A zoom crop in picture space: the top-left corner and the width, as
 * fractions of the picture. Its height is the same fraction, so the crop keeps
 * the picture's aspect ratio; `w` = 1 is the whole picture (no zoom).
 */
export interface ZoomRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

/** The whole picture: no zoom. */
export const FULL_PICTURE: ZoomRect = { x: 0, y: 0, w: 1 };

/** How the picture gets from one zoom keyframe to the next. */
export type ZoomEase = "glide" | "hold";
export const ZOOM_EASES: readonly ZoomEase[] = ["glide", "hold"];

/**
 * A zoom keyframe. One keyframe is a fixed crop for the whole clip; between two,
 * `ease` says whether the picture glides to the next crop or holds this one
 * until the next keyframe.
 */
export interface ZoomKey {
  readonly atS: number;
  readonly rect: ZoomRect;
  readonly ease: ZoomEase;
}

/**
 * A marker: telestration strokes (arrows, circles, lines) shown from `atS` for
 * `holdS` seconds. A freezing marker stops the picture while it shows; a
 * running one shows over the playing video, for `holdS` seconds of clip.
 */
export interface ClipMark {
  readonly id: string;
  readonly atS: number;
  readonly holdS: number;
  readonly freeze: boolean;
  readonly strokes: readonly Stroke[];
}

/** One collection entry's edit, version 1. */
export interface ClipEdit {
  readonly v: typeof CLIP_EDIT_VERSION;
  /** The entry's in and out point; null plays the whole clip window. */
  readonly trim: TimeRange | null;
  /** Slow-motion stretches, in play order, never overlapping. */
  readonly slow: readonly SlowRange[];
  /** Zoom keyframes, in play order, at distinct times. */
  readonly zoom: readonly ZoomKey[];
  /** Markers, in play order. */
  readonly marks: readonly ClipMark[];
}

/** An edit that changes nothing: the plain clip. */
export const EMPTY_EDIT: ClipEdit = {
  v: CLIP_EDIT_VERSION,
  trim: null,
  slow: [],
  zoom: [],
  marks: [],
};

/** Limits that keep an edit an edit, not a data dump shipped to every viewer. */
export const MAX_SLOW_RANGES = 10;
export const MAX_ZOOM_KEYS = 20;
export const MAX_MARKS = 30;
export const MAX_STROKE_POINTS = 2000;
/** Max length of an edit as JSON text, checked on the submitted text and the clean copy. */
export const MAX_EDIT_JSON_LENGTH = 128 * 1024;
/** The shortest trimmed clip, in seconds. */
export const MIN_TRIM_S = 0.5;
/** The deepest zoom: a crop a fifth of the picture wide (5x). */
export const MIN_ZOOM_WIDTH = 0.2;
/** How long a marker can show, in seconds. */
export const MIN_HOLD_S = 0.1;
export const MAX_HOLD_S = 30;

const MARK_ID_RE = /^[a-z0-9]{1,12}$/;
/** Times are kept to the millisecond, picture positions to a ten-thousandth. */
const TIME_STEP = 1000;
const PICTURE_STEP = 10_000;

type Json = Record<string, unknown>;

/** A parse outcome: the clean value, or why the input was refused. */
export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

class InvalidEdit extends Error {}

function fail(message: string): never {
  throw new InvalidEdit(message);
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T>(values: readonly T[], value: unknown): value is T {
  return values.some((candidate) => candidate === value);
}

/** A game time: finite, not negative, kept to the millisecond. */
function time(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(`${field} must be a time in seconds`);
  }
  return Math.round(value * TIME_STEP) / TIME_STEP;
}

/** A picture fraction in [0, 1], kept to a ten-thousandth. */
function fraction(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    fail(`${field} must lie between 0 and 1`);
  }
  return Math.round(value * PICTURE_STEP) / PICTURE_STEP;
}

function list(value: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(value)) fail(`${field} must be a list`);
  if (value.length > max) fail(`${field} holds more than ${max} entries`);
  return value;
}

function parseRange(value: unknown, field: string): TimeRange {
  if (!isObject(value)) fail(`${field} must be a time range`);
  const startS = time(value.startS, `${field}.startS`);
  const endS = time(value.endS, `${field}.endS`);
  if (endS <= startS) fail(`${field} must end after it starts`);
  return { startS, endS };
}

function parseTrim(value: unknown): TimeRange | null {
  if (value === undefined || value === null) return null;
  const trim = parseRange(value, "trim");
  if (trim.endS - trim.startS < MIN_TRIM_S) {
    fail(`trim must be at least ${MIN_TRIM_S}s long`);
  }
  return trim;
}

function parseSlow(value: unknown): SlowRange[] {
  const ranges = list(value, "slow", MAX_SLOW_RANGES).map((raw, index) => {
    const range = parseRange(raw, `slow[${index}]`);
    const rate = (raw as Json).rate;
    if (!isOneOf(SLOW_RATES, rate)) {
      fail(`slow[${index}].rate must be one of ${SLOW_RATES.join(", ")}`);
    }
    return { ...range, rate };
  });
  ranges.sort((a, b) => a.startS - b.startS);
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index].startS < ranges[index - 1].endS) {
      fail("slow-motion ranges must not overlap");
    }
  }
  return ranges;
}

function parseRect(value: unknown, field: string): ZoomRect {
  if (!isObject(value)) fail(`${field} must be a crop`);
  const w = fraction(value.w, `${field}.w`);
  if (w < MIN_ZOOM_WIDTH) {
    fail(`${field}.w must be at least ${MIN_ZOOM_WIDTH}`);
  }
  const x = fraction(value.x, `${field}.x`);
  const y = fraction(value.y, `${field}.y`);
  // Rounding may nudge a crop flush with the edge a hair past it; anything
  // further is a crop reaching outside the picture.
  const slack = 1 / PICTURE_STEP;
  if (x + w > 1 + slack || y + w > 1 + slack) {
    fail(`${field} must lie inside the picture`);
  }
  return { x: Math.min(x, 1 - w), y: Math.min(y, 1 - w), w };
}

function parseZoom(value: unknown): ZoomKey[] {
  const keys = list(value, "zoom", MAX_ZOOM_KEYS).map((raw, index) => {
    const field = `zoom[${index}]`;
    if (!isObject(raw)) fail(`${field} must be a zoom keyframe`);
    if (!isOneOf(ZOOM_EASES, raw.ease)) {
      fail(`${field}.ease must be one of ${ZOOM_EASES.join(", ")}`);
    }
    return {
      atS: time(raw.atS, `${field}.atS`),
      rect: parseRect(raw.rect, `${field}.rect`),
      ease: raw.ease,
    };
  });
  keys.sort((a, b) => a.atS - b.atS);
  for (let index = 1; index < keys.length; index += 1) {
    if (keys[index].atS === keys[index - 1].atS) {
      fail("zoom keyframes must lie at distinct times");
    }
  }
  return keys;
}

function parsePoint(value: unknown, field: string): PicturePoint {
  if (!isObject(value)) fail(`${field} must be a point`);
  return {
    x: fraction(value.x, `${field}.x`),
    y: fraction(value.y, `${field}.y`),
  };
}

/**
 * A marker stroke, in the telestration model: an arrow or a circle keeps its
 * two corner points, a free line or a curved arrow its sampled points.
 */
function parseStroke(value: unknown, field: string): Stroke {
  if (!isObject(value)) fail(`${field} must be a stroke`);
  const { tool, color, width, style } = value;
  if (!isOneOf(DRAW_TOOLS, tool)) fail(`${field}.tool is not a drawing tool`);
  if (!isOneOf(PEN_COLORS, color)) fail(`${field}.color is not a pen colour`);
  if (!isOneOf(STROKE_WIDTHS, width)) fail(`${field}.width is not a width`);
  if (style !== "solid" && style !== "dotted") {
    fail(`${field}.style must be solid or dotted`);
  }
  const points = list(value.points, `${field}.points`, MAX_STROKE_POINTS);
  const twoPoint = tool === "arrow" || tool === "circle";
  if (twoPoint ? points.length !== 2 : points.length < 2) {
    fail(
      `${field}.points must hold ${twoPoint ? "exactly" : "at least"} two points`,
    );
  }
  return {
    tool,
    color,
    width,
    style,
    points: points.map((point, index) =>
      parsePoint(point, `${field}.points[${index}]`),
    ),
  };
}

function parseMarks(value: unknown): ClipMark[] {
  const marks = list(value, "marks", MAX_MARKS).map((raw, index) => {
    const field = `marks[${index}]`;
    if (!isObject(raw)) fail(`${field} must be a marker`);
    if (typeof raw.id !== "string" || !MARK_ID_RE.test(raw.id)) {
      fail(`${field}.id must be a short lowercase id`);
    }
    if (typeof raw.freeze !== "boolean") {
      fail(`${field}.freeze must be true or false`);
    }
    const holdS = time(raw.holdS, `${field}.holdS`);
    if (holdS < MIN_HOLD_S || holdS > MAX_HOLD_S) {
      fail(`${field}.holdS must lie between ${MIN_HOLD_S}s and ${MAX_HOLD_S}s`);
    }
    const strokes = list(raw.strokes, `${field}.strokes`, Infinity);
    if (strokes.length === 0) fail(`${field} must hold at least one stroke`);
    return {
      id: raw.id,
      atS: time(raw.atS, `${field}.atS`),
      holdS,
      freeze: raw.freeze,
      strokes: strokes.map((stroke, strokeIndex) =>
        parseStroke(stroke, `${field}.strokes[${strokeIndex}]`),
      ),
    };
  });
  if (new Set(marks.map((mark) => mark.id)).size !== marks.length) {
    fail("marker ids must be unique");
  }
  // A stable sort keeps markers at the same moment in the coach's order.
  return marks.sort((a, b) => a.atS - b.atS);
}

/**
 * Validate an untrusted edit (parsed JSON), returning a clean copy or why it
 * was refused. Times are kept to the millisecond and picture positions to a
 * ten-thousandth; ranges, keyframes and markers come back in play order.
 */
export function parseClipEdit(value: unknown): ParseResult<ClipEdit> {
  try {
    if (!isObject(value)) fail("an edit must be an object");
    if (value.v !== CLIP_EDIT_VERSION) {
      fail(`an edit must be version ${CLIP_EDIT_VERSION}`);
    }
    const edit: ClipEdit = {
      v: CLIP_EDIT_VERSION,
      trim: parseTrim(value.trim),
      slow: parseSlow(value.slow),
      zoom: parseZoom(value.zoom),
      marks: parseMarks(value.marks),
    };
    if (JSON.stringify(edit).length > MAX_EDIT_JSON_LENGTH) {
      fail(`an edit must stay under ${MAX_EDIT_JSON_LENGTH / 1024} KiB`);
    }
    return { ok: true, value: edit };
  } catch (error) {
    if (error instanceof InvalidEdit)
      return { ok: false, error: error.message };
    throw error;
  }
}

/** Whether `edit` changes nothing, so the entry plays the plain clip. */
export function isEmptyEdit(edit: ClipEdit): boolean {
  return (
    edit.trim === null &&
    edit.slow.length === 0 &&
    edit.zoom.length === 0 &&
    edit.marks.length === 0
  );
}

/**
 * Why `edit` does not fit the clip window it is saved against, or null when
 * it does: every time must lie inside the window, the footage the clip file
 * holds. Lengthening a clip widens its tag window (a re-cut) first; an edit
 * cannot reach outside it.
 */
export function checkEditWindow(
  edit: ClipEdit,
  window: TimeRange,
): string | null {
  const inside = (s: number) => s >= window.startS && s <= window.endS;
  if (edit.trim && !(inside(edit.trim.startS) && inside(edit.trim.endS))) {
    return "the trim reaches outside the clip";
  }
  if (
    edit.slow.some((range) => !(inside(range.startS) && inside(range.endS)))
  ) {
    return "a slow-motion range reaches outside the clip";
  }
  if (edit.zoom.some((key) => !inside(key.atS))) {
    return "a zoom keyframe lies outside the clip";
  }
  if (edit.marks.some((mark) => !inside(mark.atS))) {
    return "a marker lies outside the clip";
  }
  return null;
}

/** What a save of an entry's edit carries: the edit, or null to clear it. */
export interface SaveEditInput {
  /** The edit version the editor started from; a newer one on the server refuses the save. */
  readonly version: number;
  readonly edit: ClipEdit | null;
}

/**
 * Validate a save request body (parsed JSON): `{ version, edit }`, where `edit`
 * is an edit document or null. An edit that changes nothing is stored as null,
 * so an entry never reads as edited when it is not.
 */
export function parseSaveEditInput(value: unknown): ParseResult<SaveEditInput> {
  if (!isObject(value)) return { ok: false, error: "body must be an object" };
  const { version } = value;
  if (
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    return { ok: false, error: "version must be a whole number" };
  }
  if (value.edit === null) return { ok: true, value: { version, edit: null } };
  const edit = parseClipEdit(value.edit);
  if (!edit.ok) return edit;
  return {
    ok: true,
    value: { version, edit: isEmptyEdit(edit.value) ? null : edit.value },
  };
}
