/**
 * Coordinate transforms between the pitch (metres, ADR 0010) and the board on
 * screen. The board is an SVG whose user units are metres, so the scene scales
 * with the screen for free; the only choices here are which part of the board
 * is on show, which way round it lies and where a pointer lands on it.
 *
 * A {@link BoardLayout} is that choice: the bounds of the board on show (the
 * whole board or a short-corner quarter, see `viewBounds`) and a quarter turn.
 * The full board lies as in the FIH plan (the left goal on the left) on a
 * landscape screen, and is turned a quarter to the left on a phone held
 * upright, so the left goal sits at the bottom. A short-corner quarter is tall
 * and narrow, so it goes the other way: upright on a phone as it is, and on a
 * landscape screen turned so its goal sits at the top.
 */
import {
  BOARD_BOUNDS,
  viewBounds,
  type PitchBounds,
  type PitchPoint,
  type PitchView,
} from "./pitch";

import { containRect } from "@/features/player/telestration/geometry";

/** Which way the screen is held: a phone upright is `portrait`. */
export type Orientation = "landscape" | "portrait";

/**
 * How the board is turned on screen: not at all, a quarter to the left
 * (counter-clockwise) or a quarter to the right (clockwise).
 */
export type Turn = "none" | "left" | "right";

/** The part of the board on show and which way round it lies. */
export interface BoardLayout {
  readonly bounds: PitchBounds;
  readonly turn: Turn;
}

/** The layout of a scene's view on a screen held one way. */
export function boardLayout(
  view: PitchView,
  orientation: Orientation,
): BoardLayout {
  const bounds = viewBounds(view);
  if (view === "full")
    return { bounds, turn: orientation === "portrait" ? "left" : "none" };
  // Turn the quarter clockwise, which puts its goal at the top.
  return { bounds, turn: orientation === "portrait" ? "none" : "right" };
}

/** The board's size in view units (metres) for a layout. */
export function viewSize({ bounds, turn }: BoardLayout): {
  width: number;
  height: number;
} {
  // Rounded to the millimetre: `94.4 - 67.5` is not quite 26.9 in floating point.
  const length = Math.round((bounds.maxX - bounds.minX) * 1000) / 1000;
  const width = Math.round((bounds.maxY - bounds.minY) * 1000) / 1000;
  return turn === "none"
    ? { width: length, height: width }
    : { width, height: length };
}

/**
 * The SVG `matrix(a b c d e f)` that places pitch coordinates in the view:
 * `u = a*x + c*y + e`, `v = b*x + d*y + f`.
 */
export function viewMatrix({ bounds, turn }: BoardLayout): string {
  const { minX, minY, maxX, maxY } = bounds;
  if (turn === "none") return `matrix(1 0 0 1 ${-minX} ${-minY})`;
  if (turn === "left") return `matrix(0 -1 1 0 ${-minY} ${maxX})`;
  return `matrix(0 1 -1 0 ${maxY} ${-minX})`;
}

/** Map a pitch point to view units (metres from the view's top-left). */
export function toView(
  point: PitchPoint,
  { bounds, turn }: BoardLayout,
): { u: number; v: number } {
  const { minX, minY, maxX, maxY } = bounds;
  if (turn === "none") return { u: point.x - minX, v: point.y - minY };
  if (turn === "left") return { u: point.y - minY, v: maxX - point.x };
  return { u: maxY - point.y, v: point.x - minX };
}

/** Map view units back to a pitch point (the inverse of {@link toView}). */
export function fromView(
  u: number,
  v: number,
  { bounds, turn }: BoardLayout,
): PitchPoint {
  const { minX, minY, maxX, maxY } = bounds;
  if (turn === "none") return { x: u + minX, y: v + minY };
  if (turn === "left") return { x: maxX - v, y: u + minY };
  return { x: v + minX, y: maxY - u };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Keep a point inside bounds: by default the board, the field plus its run-off. */
export function clampToBoard(
  point: PitchPoint,
  bounds: PitchBounds = BOARD_BOUNDS,
): PitchPoint {
  return {
    x: clamp(point.x, bounds.minX, bounds.maxX),
    y: clamp(point.y, bounds.minY, bounds.maxY),
  };
}

/**
 * Whether any of a shape within `margin` metres of these points can show
 * inside the bounds: the box around the points, widened by the margin,
 * overlaps them. A curve lies inside the box of its start, control and end.
 */
export function overlapsBounds(
  points: readonly PitchPoint[],
  bounds: PitchBounds,
  margin = 0,
): boolean {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return (
    Math.max(...xs) + margin > bounds.minX &&
    Math.min(...xs) - margin < bounds.maxX &&
    Math.max(...ys) + margin > bounds.minY &&
    Math.min(...ys) - margin < bounds.maxY
  );
}

/** The part of the element the board fills, as its bounding rectangle reports it. */
export interface ElementBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The pitch point under a pointer at client coordinates, for an SVG laid out
 * in `box`. The SVG keeps its aspect ratio (`xMidYMid meet`), so the board is
 * the contained rectangle inside the box, not the box itself. Clamped to the
 * board, so a drag past the edge keeps the token on it.
 */
export function clientToPitch(
  clientX: number,
  clientY: number,
  box: ElementBox,
  layout: BoardLayout,
): PitchPoint {
  const view = viewSize(layout);
  const board = containRect(box.width, box.height, view.width, view.height);
  if (board.width <= 0 || board.height <= 0) return fromView(0, 0, layout);
  const scale = view.width / board.width;
  const u = (clientX - box.left - board.x) * scale;
  const v = (clientY - box.top - board.y) * scale;
  return clampToBoard(fromView(u, v, layout), layout.bounds);
}

/**
 * Turn a move on screen (an arrow key: right is `dx` +1, down is `dy` +1)
 * into the same move on the pitch, so a nudge goes the way the key points
 * whichever way round the pitch lies.
 */
export function screenToPitchDelta(
  dx: number,
  dy: number,
  { turn }: BoardLayout,
): PitchPoint {
  if (turn === "none") return { x: dx, y: dy };
  if (turn === "left") return { x: negate(dy), y: dx };
  return { x: dy, y: negate(dx) };
}

/** `-value`, without a negative zero. */
function negate(value: number): number {
  return value === 0 ? 0 : -value;
}

/** The angles a line held with Shift keeps to: multiples of 45 degrees. */
export const SNAP_ANGLE = Math.PI / 4;

/**
 * Where a line from `from` towards `to` ends when held to a multiple of
 * {@link SNAP_ANGLE}: along the nearest such direction, as far as `to`
 * reaches along it, and shortened to stay inside the bounds. A quarter turn
 * of the board keeps these angles, so the line is as straight on screen.
 */
export function snapToAngle(
  from: PitchPoint,
  to: PitchPoint,
  bounds: PitchBounds,
): PitchPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return to;
  const angle = Math.round(Math.atan2(dy, dx) / SNAP_ANGLE) * SNAP_ANGLE;
  // Rounded so a right angle's cosine is zero, not 6e-17.
  const ux = Math.round(Math.cos(angle) * 1e9) / 1e9;
  const uy = Math.round(Math.sin(angle) * 1e9) / 1e9;
  let length = Math.max(0, dx * ux + dy * uy);
  if (ux > 0) length = Math.min(length, (bounds.maxX - from.x) / ux);
  if (ux < 0) length = Math.min(length, (bounds.minX - from.x) / ux);
  if (uy > 0) length = Math.min(length, (bounds.maxY - from.y) / uy);
  if (uy < 0) length = Math.min(length, (bounds.minY - from.y) / uy);
  return { x: from.x + ux * length, y: from.y + uy * length };
}

/** How far a point lies from the segment between `a` and `b`. */
function distanceToSegment(
  point: PitchPoint,
  a: PitchPoint,
  b: PitchPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.min(
          Math.max(((point.x - a.x) * dx + (point.y - a.y) * dy) / length, 0),
          1,
        );
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * A hand-drawn path with the points it can do without left out
 * (Ramer-Douglas-Peucker): every point dropped lies within `tolerance` metres
 * of the simplified path. The first and last points always stay.
 */
export function simplifyPath(
  points: readonly PitchPoint[],
  tolerance: number,
): PitchPoint[] {
  if (points.length < 3) return [...points];
  const first = points[0] as PitchPoint;
  const last = points[points.length - 1] as PitchPoint;
  let farthest = 0;
  let at = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = distanceToSegment(
      points[index] as PitchPoint,
      first,
      last,
    );
    if (distance > farthest) {
      farthest = distance;
      at = index;
    }
  }
  if (farthest <= tolerance) return [first, last];
  return [
    ...simplifyPath(points.slice(0, at + 1), tolerance).slice(0, -1),
    ...simplifyPath(points.slice(at), tolerance),
  ];
}

/** Round to the centimetre: finer than any drag, and short in the stored JSON. */
export function roundPoint(point: PitchPoint): PitchPoint {
  return {
    x: Math.round(point.x * 100) / 100,
    y: Math.round(point.y * 100) / 100,
  };
}
