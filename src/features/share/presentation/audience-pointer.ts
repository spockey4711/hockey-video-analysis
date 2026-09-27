/**
 * Where the laser pointer is, in terms both windows share (ADR 0015). The
 * presenter's stage and the projector's are different shapes, so a spot in
 * one box means nothing in the other; the spot on the picture itself - the
 * clip's frame or the scene's pitch, fitted into each box - does.
 */
import type { LaserSpotPosition } from "./LaserPointer";

import {
  containRect,
  type PicturePoint,
} from "@/features/player/telestration/geometry";

/** The picture's own width and height, e.g. a video's in pixels. */
export interface PictureSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The pointer's spot on the picture fitted into its box, both axes 0 to 1,
 * or `null` while it is over the bars beside the picture.
 */
export function spotOnPicture(
  spot: LaserSpotPosition,
  picture: PictureSize,
): PicturePoint | null {
  const rect = containRect(
    spot.width,
    spot.height,
    picture.width,
    picture.height,
  );
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = (spot.x - rect.x) / rect.width;
  const y = (spot.y - rect.y) / rect.height;
  const outside = (value: number) => value < -EDGE || value > 1 + EDGE;
  if (outside(x) || outside(y)) return null;
  return { x: clamp01(x), y: clamp01(y) };
}

/** Rounding room at the picture's edge, far below a pixel. */
const EDGE = 1e-9;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
