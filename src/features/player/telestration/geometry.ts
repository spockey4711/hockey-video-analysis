/**
 * Coordinate model for telestration (P2-10). Every stroke is stored in
 * picture space: `x` and `y` run from 0 to 1 across the video picture itself,
 * not the stage around it. The stage letterboxes the picture (`object-contain`),
 * so the same drawing lands on the same spot of the frame whatever the window
 * size, and the still export can replay it at the video's native resolution by
 * scaling to a different rectangle.
 */

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

/**
 * Pen width for a picture of the given pixel width. Proportional to the picture
 * rather than fixed, so the exported still (drawn at the video's native width)
 * looks exactly like what the coach drew on screen.
 */
export function penWidth(pictureWidth: number): number {
  return Math.max(pictureWidth * 0.004, 2);
}
