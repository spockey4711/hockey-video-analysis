/**
 * Coordinate model for telestration (P2-10). Every stroke is stored in
 * picture space: `x` and `y` run from 0 to 1 across the video picture itself,
 * not the stage around it. The stage letterboxes the picture (`object-contain`),
 * so the same drawing lands on the same spot of the frame whatever the window
 * size, and the still export can replay it at the video's native resolution by
 * scaling to a different rectangle.
 */

import type { StrokeWidth } from "./state";

/** A point on the video picture, both axes normalized to `[0, 1]`. */
export interface PicturePoint {
  readonly x: number;
  readonly y: number;
}

/** An axis-aligned rectangle in some pixel space (stage CSS pixels, or video pixels). */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where an `object-contain` video's picture sits inside its box: scaled to fit
 * and centred, leaving bars on two sides. Falls back to the whole box while the
 * media size is still unknown (metadata not loaded yet).
 */
export function containRect(
  boxWidth: number,
  boxHeight: number,
  mediaWidth: number,
  mediaHeight: number,
): Rect {
  if (mediaWidth <= 0 || mediaHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return {
      x: 0,
      y: 0,
      width: Math.max(boxWidth, 0),
      height: Math.max(boxHeight, 0),
    };
  }
  const scale = Math.min(boxWidth / mediaWidth, boxHeight / mediaHeight);
  const width = mediaWidth * scale;
  const height = mediaHeight * scale;
  return {
    x: (boxWidth - width) / 2,
    y: (boxHeight - height) / 2,
    width,
    height,
  };
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Map a pixel position (in the same space as `picture`) to a picture point.
 * Clamped to the picture, so a stroke dragged over the letterbox bars sticks to
 * the frame's edge instead of drawing onto the bars.
 */
export function toPicturePoint(
  px: number,
  py: number,
  picture: Rect,
): PicturePoint {
  if (picture.width <= 0 || picture.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp01((px - picture.x) / picture.width),
    y: clamp01((py - picture.y) / picture.height),
  };
}

/** Map a picture point back to pixels in the space of `picture`. */
export function toPixel(
  point: PicturePoint,
  picture: Rect,
): { x: number; y: number } {
  return {
    x: picture.x + point.x * picture.width,
    y: picture.y + point.y * picture.height,
  };
}

/** How much thinner or thicker each width step is than the medium pen. */
export const STROKE_WIDTH_SCALE: Readonly<Record<StrokeWidth, number>> = {
  thin: 0.5,
  medium: 1,
  thick: 1.6,
};

/**
 * Pen width for a picture of the given pixel width. Proportional to the picture
 * rather than fixed, so the exported still (drawn at the video's native width)
 * looks exactly like what the coach drew on screen. The medium step never gets
 * thinner than two pixels; the other steps keep their ratio to it.
 */
export function penWidth(
  pictureWidth: number,
  width: StrokeWidth = "medium",
): number {
  return Math.max(pictureWidth * 0.004, 2) * STROKE_WIDTH_SCALE[width];
}

/** Centre-to-centre distance between dots, in pen widths. */
export const DOT_SPACING = 3.6;

/**
 * The on/off pattern of a dotted stroke `width` pixels wide, as a canvas line
 * dash. It scales with the pen, so the dots keep their rhythm on every width
 * step and on the exported still. With round caps each "on" run is drawn half
 * a pen longer at either end, so a zero-length run is a round dot one pen wide,
 * and the gap is wide enough that even the halo around the dots (about three
 * pens wide) leaves clear space between them.
 */
export function dashPattern(width: number): [number, number] {
  return [0, width * DOT_SPACING];
}

/** A quadratic Bezier curve: it leaves `start` towards `control` and ends at `end`. */
export interface Curve {
  readonly start: PicturePoint;
  readonly control: PicturePoint;
  readonly end: PicturePoint;
}

/**
 * How far along the curve the drag's bulge may sit, at the most off-centre.
 * Pinning a bulge closer to an end would need a control point far off the
 * picture, which bends the curve into a hook.
 */
const MIN_BULGE_T = 0.2;

/**
 * The curve a drag describes: from where it started to where it ended, bent
 * through the sampled point farthest from the straight line between them (the
 * bulge the coach drew). That point sits on the curve at the fraction of the
 * way along the chord it projects to, so the curve follows the drag rather than
 * a fixed symmetric arc. A straight drag makes a straight curve, and feeding the
 * result's `[start, through, end]` back in gives the same curve again.
 */
export function curveThrough(points: readonly PicturePoint[]): Curve | null {
  const start = points[0];
  const end = points[points.length - 1];
  if (!start || !end) return null;
  const through = bulgePoint(points, start, end);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chord = dx * dx + dy * dy;
  const projected =
    chord === 0
      ? 0.5
      : ((through.x - start.x) * dx + (through.y - start.y) * dy) / chord;
  const t = Math.min(Math.max(projected, MIN_BULGE_T), 1 - MIN_BULGE_T);
  // B(t) = (1-t)^2 start + 2t(1-t) control + t^2 end, solved for control.
  const u = 1 - t;
  const control = {
    x: (through.x - u * u * start.x - t * t * end.x) / (2 * t * u),
    y: (through.y - u * u * start.y - t * t * end.y) / (2 * t * u),
  };
  return { start, control, end };
}

/** The sampled point farthest from the chord `start` - `end`, or its midpoint. */
function bulgePoint(
  points: readonly PicturePoint[],
  start: PicturePoint,
  end: PicturePoint,
): PicturePoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  let best: PicturePoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  let bestDistance = 0;
  for (const point of points) {
    const distance =
      length === 0
        ? Math.hypot(point.x - start.x, point.y - start.y)
        : Math.abs((point.x - start.x) * dy - (point.y - start.y) * dx) /
          length;
    if (distance > bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * A point behind the curve's end along its end tangent, which is where an
 * arrowhead on the curve points from. The tangent at the end of a quadratic
 * Bezier runs from the control point to the end; when the two coincide it falls
 * back to the direction from the start.
 */
export function curveHeadTail(curve: Curve): PicturePoint {
  const { start, control, end } = curve;
  return control.x === end.x && control.y === end.y ? start : control;
}
