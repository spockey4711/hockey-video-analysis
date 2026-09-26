/**
 * Turning a clip edit into what a player applies while the clip plays (ADR
 * 0011).
 *
 * An edit is stored in global game time; a player only knows the clip file's
 * own clock (`currentTime`). {@link toPlaybackPlan} maps the edit onto that
 * clock on the server, using where the clip file really starts
 * (`clips.cut_start_s`), and clamps it to the footage the file holds. The
 * players then ask {@link editStateAt} on every frame what to apply: the
 * playback rate, the zoom crop, the running markers, and whether the out-point
 * has passed. A freezing marker is a pause rather than a state at one moment,
 * so the player asks {@link freezeCrossed} whether a frame stepped over one.
 *
 * Pure and DOM-free, so the timing rules are unit-tested on their own and the
 * editor preview, the collection link and presentation mode all play an edit
 * the same way.
 */
import {
  FULL_PICTURE,
  type ClipEdit,
  type ClipMark,
  type SlowRange,
  type TimeRange,
  type ZoomKey,
  type ZoomRect,
} from "./edit";

/** Where a clip's file sits in game time. */
export interface ClipTimeline {
  /**
   * The game time at clip-file time 0 (`clips.cut_start_s`), or null while the
   * worker has not probed it yet.
   */
  readonly cutStartS: number | null;
  /** The tag window the clip file was cut for, in game time. */
  readonly window: TimeRange;
}

/** Game time to clip-file time, for a file starting at `cutStartS`. */
export function toFileS(gameS: number, cutStartS: number): number {
  return gameS - cutStartS;
}

/** Clip-file time to game time, for a file starting at `cutStartS`. */
export function toGameS(fileS: number, cutStartS: number): number {
  return fileS + cutStartS;
}

/**
 * An edit on the clip file's clock: every time is clip-file seconds, and
 * everything outside the in and out point is left out. Display-ready, so it
 * is built on the server and handed to the player as is.
 */
export interface PlaybackPlan {
  /** Where playback starts. */
  readonly inS: number;
  /** Where playback stops. */
  readonly outS: number;
  readonly slow: readonly SlowRange[];
  /** All keyframes, also those outside the in and out point, which still shape the crop inside. */
  readonly zoom: readonly ZoomKey[];
  readonly marks: readonly ClipMark[];
  /**
   * False while the file's real start is unknown: the plan then assumes the
   * file starts at the tag, as plain playback always did, and can be off by up
   * to a keyframe interval.
   */
  readonly exact: boolean;
  /**
   * True when the stored trim no longer fits the clip, because its window was
   * shortened after the edit was saved; the editor flags such an entry.
   */
  readonly trimClamped: boolean;
}

/** Differences below this many seconds are rounding noise, not time. */
const EPSILON_S = 1e-6;

/**
 * Longer than one frame of footage at 24 fps or more. A frame shows from its
 * own time until the next one's, so the frame a seek to the in point lands on
 * starts up to a frame before it.
 */
const FRAME_TOLERANCE_S = 0.05;

/** The part of `trim` inside `window`, or null when they do not overlap. */
function intersect(trim: TimeRange, window: TimeRange): TimeRange | null {
  const startS = Math.max(trim.startS, window.startS);
  const endS = Math.min(trim.endS, window.endS);
  return endS - startS > EPSILON_S ? { startS, endS } : null;
}

/**
 * Map `edit` (null for the plain clip) onto the clip file's clock.
 *
 * The in and out point are the trim, clamped to the clip window; a trim wholly
 * outside the window falls back to the window. Slow-motion ranges are cut to
 * the in and out point and markers are kept only where they can show between
 * them.
 */
export function toPlaybackPlan(
  edit: ClipEdit | null,
  { cutStartS, window }: ClipTimeline,
): PlaybackPlan {
  const origin = cutStartS ?? window.startS;
  const file = (gameS: number) => toFileS(gameS, origin);

  const clamped = edit?.trim ? intersect(edit.trim, window) : null;
  const range = clamped ?? window;
  const trimClamped =
    edit?.trim != null &&
    (clamped === null ||
      clamped.startS !== edit.trim.startS ||
      clamped.endS !== edit.trim.endS);

  const inS = Math.max(0, file(range.startS));
  const outS = file(range.endS);

  const slow = (edit?.slow ?? [])
    .map((slowRange) => ({
      startS: Math.max(inS, file(slowRange.startS)),
      endS: Math.min(outS, file(slowRange.endS)),
      rate: slowRange.rate,
    }))
    .filter((slowRange) => slowRange.endS - slowRange.startS > EPSILON_S);

  const zoom = (edit?.zoom ?? []).map((key) => ({
    ...key,
    atS: file(key.atS),
  }));

  const marks = (edit?.marks ?? [])
    .map((mark) => ({ ...mark, atS: file(mark.atS) }))
    .filter((mark) =>
      mark.freeze
        ? mark.atS >= inS && mark.atS <= outS
        : mark.atS + mark.holdS > inS && mark.atS < outS,
    );

  return {
    inS,
    outS,
    slow,
    zoom,
    marks,
    exact: cutStartS !== null,
    trimClamped,
  };
}

/** What a player applies at one moment of the clip file. */
export interface EditState {
  /** The playback rate: 1, or a slow-motion rate. Slow motion plays muted. */
  readonly rate: number;
  /** The part of the picture to show. */
  readonly zoom: ZoomRect;
  /** The running markers showing now; freezing markers come from {@link freezeCrossed}. */
  readonly marks: readonly ClipMark[];
  /**
   * True more than a frame before the in point: the player seeks there first.
   * The frame showing the in point itself does not count, or every seek there
   * would ask for another.
   */
  readonly beforeIn: boolean;
  /** True at or past the out point: the player stops. */
  readonly ended: boolean;
}

/** The slow-motion rate at `t`, or 1 outside every range. */
function rateAt(slow: readonly SlowRange[], t: number): number {
  const range = slow.find(
    (candidate) => t >= candidate.startS && t < candidate.endS,
  );
  return range?.rate ?? 1;
}

/** Ease in and out, so a glide starts and lands gently. */
function smoothstep(p: number): number {
  return p * p * (3 - 2 * p);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The crop part of the way `p` (0..1) from `from` to `to`. The width changes
 * geometrically, so the zoom feels even rather than rushing at the deep end,
 * and the centre moves in a straight line; the corner is clamped to keep the
 * crop inside the picture.
 */
export function interpolateRect(
  from: ZoomRect,
  to: ZoomRect,
  p: number,
): ZoomRect {
  const w = from.w * (to.w / from.w) ** p;
  const centre = (a: number, b: number) =>
    a + from.w / 2 + (b + to.w / 2 - (a + from.w / 2)) * p;
  return {
    x: clamp(centre(from.x, to.x) - w / 2, 0, 1 - w),
    y: clamp(centre(from.y, to.y) - w / 2, 0, 1 - w),
    w,
  };
}

/**
 * The crop at `t`: the whole picture without keyframes, the first or last
 * keyframe's crop before or after them, and in between either the earlier
 * crop held or a glide to the next.
 */
export function zoomAt(keys: readonly ZoomKey[], t: number): ZoomRect {
  if (keys.length === 0) return FULL_PICTURE;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (t <= first.atS) return first.rect;
  if (t >= last.atS) return last.rect;
  const next = keys.findIndex((key) => key.atS > t);
  const from = keys[next - 1];
  const to = keys[next];
  if (from.ease === "hold") return from.rect;
  const p = smoothstep((t - from.atS) / (to.atS - from.atS));
  return interpolateRect(from.rect, to.rect, p);
}

/** What to apply at clip-file time `t` under `plan`. */
export function editStateAt(plan: PlaybackPlan, t: number): EditState {
  return {
    rate: rateAt(plan.slow, t),
    zoom: zoomAt(plan.zoom, t),
    marks: plan.marks.filter(
      (mark) => !mark.freeze && t >= mark.atS && t < mark.atS + mark.holdS,
    ),
    beforeIn: t < plan.inS - FRAME_TOLERANCE_S,
    ended: t >= plan.outS,
  };
}

/**
 * The first freezing marker whose moment lies in `(fromS, toS]` - the stretch
 * between two frames the player showed - or null. The player then stops the
 * picture on that marker for its hold time. Pass `-Infinity` as `fromS` for
 * the first frame, so a marker on the in point freezes too.
 */
export function freezeCrossed(
  plan: PlaybackPlan,
  fromS: number,
  toS: number,
): ClipMark | null {
  return (
    plan.marks.find(
      (mark) => mark.freeze && mark.atS > fromS && mark.atS <= toS,
    ) ?? null
  );
}

/**
 * How close to a freezing marker's moment a still playhead counts as on it,
 * in seconds - about half a frame, so stepping or seeking onto the marker's
 * frame shows it while the next frame does not.
 */
export const MARK_SNAP_S = 0.02;

/**
 * The markers to draw at clip-file time `t`: the running ones showing then,
 * the freezing one the player holds the picture for (`heldId`), and a
 * freezing one whose frame the playhead stands on - so a paused clip, or the
 * editor stepping onto a marker, shows it just as viewers see it.
 */
export function marksShownAt(
  plan: PlaybackPlan,
  t: number,
  heldId: string | null,
): ClipMark[] {
  return plan.marks.filter((mark) =>
    mark.freeze
      ? mark.id === heldId || Math.abs(t - mark.atS) <= MARK_SNAP_S
      : t >= mark.atS && t < mark.atS + mark.holdS,
  );
}
