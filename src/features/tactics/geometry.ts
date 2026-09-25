/**
 * Coordinate transforms between the pitch (metres, ADR 0010) and the board on
 * screen. The board is an SVG whose user units are metres, so the scene scales
 * with the screen for free; the only choices here are which way round the pitch
 * lies and where a pointer lands on it.
 *
 * In `landscape` the pitch lies as in the FIH plan: the left goal on the left.
 * In `portrait` (a phone held upright) it is turned a quarter to the left, so
 * the left goal sits at the bottom and the top side-line on the left.
 */
import { BOARD_BOUNDS, type PitchPoint } from "./pitch";

import { containRect } from "@/features/player/telestration/geometry";

export type Orientation = "landscape" | "portrait";

const BOARD_LENGTH = BOARD_BOUNDS.maxX - BOARD_BOUNDS.minX;
const BOARD_WIDTH = BOARD_BOUNDS.maxY - BOARD_BOUNDS.minY;

/** The board's size in view units (metres) for an orientation. */
export function viewSize(orientation: Orientation): {
  width: number;
  height: number;
} {
  return orientation === "landscape"
    ? { width: BOARD_LENGTH, height: BOARD_WIDTH }
    : { width: BOARD_WIDTH, height: BOARD_LENGTH };
}

/**
 * The SVG `matrix(a b c d e f)` that places pitch coordinates in the view:
 * `u = a*x + c*y + e`, `v = b*x + d*y + f`.
 */
export function viewMatrix(orientation: Orientation): string {
  const { minX, minY, maxX } = BOARD_BOUNDS;
  return orientation === "landscape"
    ? `matrix(1 0 0 1 ${-minX} ${-minY})`
    : `matrix(0 -1 1 0 ${-minY} ${maxX})`;
}

/** Map a pitch point to view units (metres from the view's top-left). */
export function toView(
  point: PitchPoint,
  orientation: Orientation,
): { u: number; v: number } {
  const { minX, minY, maxX } = BOARD_BOUNDS;
  return orientation === "landscape"
    ? { u: point.x - minX, v: point.y - minY }
    : { u: point.y - minY, v: maxX - point.x };
}

/** Map view units back to a pitch point (the inverse of {@link toView}). */
export function fromView(
  u: number,
  v: number,
  orientation: Orientation,
): PitchPoint {
  const { minX, minY, maxX } = BOARD_BOUNDS;
  return orientation === "landscape"
    ? { x: u + minX, y: v + minY }
    : { x: maxX - v, y: u + minY };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Keep a point on the board: the field plus its run-off. */
export function clampToBoard(point: PitchPoint): PitchPoint {
  return {
    x: clamp(point.x, BOARD_BOUNDS.minX, BOARD_BOUNDS.maxX),
    y: clamp(point.y, BOARD_BOUNDS.minY, BOARD_BOUNDS.maxY),
  };
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
  orientation: Orientation,
): PitchPoint {
  const view = viewSize(orientation);
  const board = containRect(box.width, box.height, view.width, view.height);
  if (board.width <= 0 || board.height <= 0) return fromView(0, 0, orientation);
  const scale = view.width / board.width;
  const u = (clientX - box.left - board.x) * scale;
  const v = (clientY - box.top - board.y) * scale;
  return clampToBoard(fromView(u, v, orientation));
}

/**
 * Turn a move on screen (an arrow key: right is `dx` +1, down is `dy` +1)
 * into the same move on the pitch, so a nudge goes the way the key points
 * whichever way round the pitch lies.
 */
export function screenToPitchDelta(
  dx: number,
  dy: number,
  orientation: Orientation,
): PitchPoint {
  return orientation === "landscape"
    ? { x: dx, y: dy }
    : { x: dy === 0 ? 0 : -dy, y: dx };
}

/** Round to the centimetre: finer than any drag, and short in the stored JSON. */
export function roundPoint(point: PitchPoint): PitchPoint {
  return {
    x: Math.round(point.x * 100) / 100,
    y: Math.round(point.y * 100) / 100,
  };
}
