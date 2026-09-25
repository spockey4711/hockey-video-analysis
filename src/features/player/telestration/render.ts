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

/**
 * Arrowhead length relative to the pen width. Kept short so the head marks the
 * direction without covering the player it points at.
 */
const HEAD_LENGTH = 3;
/**
 * The smallest pen width, relative to the medium pen, an arrowhead is sized for,
 * so a thin arrow still shows clearly which way it points.
 */
const MIN_HEAD_PEN = 0.8;
/** Half-angle of the arrowhead, in radians (about 26 degrees). */
const HEAD_ANGLE = 0.45;
/** Extra width of the halo on each side of the stroke, relative to the pen. */
const HALO_SPREAD = 0.9;
const HALO_ALPHA = 0.55;
/**
 * Opacity of a whole arrow, halo included. An arrow usually runs across the
 * play, so it stays see-through enough to keep the players under it visible;
 * lines and circles mark around players rather than over them and stay solid.
 */
export const ARROW_ALPHA = 0.75;

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Pixel = { x: number; y: number };

/** Trace a stroke's outline (without the arrowhead) as the current path. */
function traceBody(ctx: Ctx2D, stroke: Stroke, picture: Rect): void {
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

/**
 * The two barb ends of an arrowhead drawn with a pen `width` wide, pointing from
 * `tail` to `tip`. `mediumWidth` is the medium pen on the same picture, which
 * sets the smallest head.
 */
export function arrowBarbs(
  tail: Pixel,
  tip: Pixel,
  width: number,
  mediumWidth: number = width,
): [Pixel, Pixel] {
  const length = Math.max(width, mediumWidth * MIN_HEAD_PEN) * HEAD_LENGTH;
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
  ctx: Ctx2D,
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
  const [left, right] = arrowBarbs(
    from,
    to,
    width,
    penWidth(picture.width, "medium"),
  );
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  return true;
}

/** Paint one stroke at the context's alpha: the dark halo, then the pen on top. */
function paintStroke(
  ctx: Ctx2D,
  stroke: Stroke,
  picture: Rect,
  palette: DrawPalette,
): void {
  const width = penWidth(picture.width, stroke.width);
  const pen = palette.pens[stroke.color];

  // Halo first, then the colour on top, so a white or yellow line still reads
  // over a bright pitch and a red one over a dark shirt.
  ctx.save();
  ctx.globalAlpha *= HALO_ALPHA;
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

/**
 * A blank offscreen layer the size of `ctx`'s canvas, sharing its transform and
 * line style, or null where the platform has none (the fallback then paints
 * straight onto `ctx`).
 */
function createLayer(ctx: Ctx2D): OffscreenCanvasRenderingContext2D | null {
  const { canvas } = ctx;
  if (typeof OffscreenCanvas === "undefined" || !canvas.width) return null;
  const layer = new OffscreenCanvas(canvas.width, canvas.height).getContext(
    "2d",
  );
  if (!layer) return null;
  layer.setTransform(ctx.getTransform());
  layer.lineCap = ctx.lineCap;
  layer.lineJoin = ctx.lineJoin;
  return layer;
}

/**
 * Paint an arrow at {@link ARROW_ALPHA}. The halo, shaft and head overlap, so
 * the arrow is painted opaque on its own layer and that layer is laid down
 * translucent in one go; fading each part separately would show darker seams
 * where they overlap.
 */
function paintArrow(
  ctx: Ctx2D,
  stroke: Stroke,
  picture: Rect,
  palette: DrawPalette,
  layer: OffscreenCanvasRenderingContext2D | null,
): void {
  ctx.save();
  ctx.globalAlpha = ARROW_ALPHA;
  if (!layer) {
    paintStroke(ctx, stroke, picture, palette);
  } else {
    const { canvas } = layer;
    layer.save();
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.clearRect(0, 0, canvas.width, canvas.height);
    layer.restore();
    paintStroke(layer, stroke, picture, palette);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, 0);
  }
  ctx.restore();
}

/** Paint every stroke, oldest first, inside `picture`. The caller clears the canvas. */
export function drawStrokes(
  ctx: Ctx2D,
  strokes: readonly Stroke[],
  picture: Rect,
  palette: DrawPalette,
): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const layer = strokes.some((stroke) => stroke.tool === "arrow")
    ? createLayer(ctx)
    : null;
  for (const stroke of strokes) {
    if (stroke.tool === "arrow") {
      paintArrow(ctx, stroke, picture, palette, layer);
    } else {
      paintStroke(ctx, stroke, picture, palette);
    }
  }
  ctx.restore();
}
