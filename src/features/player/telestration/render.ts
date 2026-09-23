/**
 * Paints telestration strokes onto a 2D canvas. One renderer serves both the
 * live overlay (picture rect in stage CSS pixels) and the still export (picture
 * rect covering the video's native pixels), which is what keeps the exported
 * image identical to what the coach saw while drawing.
 */
import { penWidth, toPixel, type Rect } from "./geometry";
import { PEN_COLORS, penColorVar, type PenColor, type Stroke } from "./state";

/** Resolved canvas colours for every pen plus the dark halo under each stroke. */
export interface DrawPalette {
  readonly pens: Readonly<Record<PenColor, string>>;
  readonly halo: string;
}

/**
 * Read the pen colours from the `--draw-*` design tokens, as computed on
 * `element` (any node under the themed root). Canvas cannot take `var(...)`, so
 * the tokens are resolved to plain colour strings here.
 */
export function readDrawPalette(element: Element): DrawPalette {
  const style = getComputedStyle(element);
  const read = (name: string): string => style.getPropertyValue(name).trim();
  const pens = Object.fromEntries(
    PEN_COLORS.map((color) => [color, read(penColorVar(color))]),
  ) as Record<PenColor, string>;
  return { pens, halo: read("--draw-halo") };
}

/** Arrowhead length relative to the pen width. */
const HEAD_LENGTH = 4.5;
/** Half-angle of the arrowhead, in radians (about 28 degrees). */
const HEAD_ANGLE = 0.5;
/** Extra width of the halo on each side of the stroke, relative to the pen. */
const HALO_SPREAD = 0.9;
const HALO_ALPHA = 0.55;

type Pixel = { x: number; y: number };

/** Trace a stroke's outline (without the arrowhead) as the current path. */
function traceBody(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  picture: Rect,
): void {
  const pts = stroke.points.map((p) => toPixel(p, picture));
  const [first] = pts;
  const last = pts[pts.length - 1];
  if (!first || !last) return;

  ctx.beginPath();
  if (stroke.tool === "circle") {
    ctx.ellipse(
      (first.x + last.x) / 2,
      (first.y + last.y) / 2,
      Math.abs(last.x - first.x) / 2,
      Math.abs(last.y - first.y) / 2,
      0,
      0,
      Math.PI * 2,
    );
    return;
  }
  ctx.moveTo(first.x, first.y);
  if (pts.length === 1) {
    // A single freehand click: a zero-length segment with round caps renders a dot.
    ctx.lineTo(first.x, first.y);
    return;
  }
  for (const point of pts.slice(1)) ctx.lineTo(point.x, point.y);
}

/** The two barb ends of an arrowhead pointing from `tail` to `tip`. */
function arrowBarbs(tail: Pixel, tip: Pixel, length: number): [Pixel, Pixel] {
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  const barb = (side: number): Pixel => ({
    x: tip.x - length * Math.cos(angle + side * HEAD_ANGLE),
    y: tip.y - length * Math.sin(angle + side * HEAD_ANGLE),
  });
  return [barb(1), barb(-1)];
}

/**
 * Trace an arrow's head as the current path. Returns false (and leaves the path
 * alone) for every other tool, so the caller never re-strokes or fills the body.
 */
function traceHead(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  picture: Rect,
  width: number,
): boolean {
  const [tail, tip] = [
    stroke.points[0],
    stroke.points[stroke.points.length - 1],
  ];
  if (stroke.tool !== "arrow" || !tail || !tip) return false;
  const from = toPixel(tail, picture);
  const to = toPixel(tip, picture);
  const [left, right] = arrowBarbs(from, to, width * HEAD_LENGTH);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  return true;
}

function paintStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  picture: Rect,
  palette: DrawPalette,
): void {
  const width = penWidth(picture.width);
  const pen = palette.pens[stroke.color];

  // Halo first, then the colour on top, so a white or yellow line still reads
  // over a bright pitch and a red one over a dark shirt.
  ctx.save();
  ctx.globalAlpha = HALO_ALPHA;
  ctx.strokeStyle = palette.halo;
  ctx.fillStyle = palette.halo;
  ctx.lineWidth = width * (1 + 2 * HALO_SPREAD);
  traceBody(ctx, stroke, picture);
  ctx.stroke();
  if (traceHead(ctx, stroke, picture, width)) ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = pen;
  ctx.fillStyle = pen;
  ctx.lineWidth = width;
  traceBody(ctx, stroke, picture);
  ctx.stroke();
  if (traceHead(ctx, stroke, picture, width)) {
    ctx.fill();
    ctx.stroke();
  }
}

/** Paint every stroke, oldest first, inside `picture`. The caller clears the canvas. */
export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: readonly Stroke[],
  picture: Rect,
  palette: DrawPalette,
): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) paintStroke(ctx, stroke, picture, palette);
  ctx.restore();
}
