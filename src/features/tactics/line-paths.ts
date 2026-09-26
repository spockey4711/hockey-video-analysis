/**
 * The SVG geometry of a board line, in pitch metres, in the telestration look:
 * the same width steps, arrowhead, curved Schlenzer arrow, dot rhythm and dark
 * halo, taken from the telestration modules rather than redrawn here. The play
 * tools add a dribble's wave and a block's end bar in the same pens. Only the
 * pen's base width differs: telestration sizes it to the video picture, the
 * board to the pitch. A view that draws its tokens smaller draws its lines
 * with a share `pen` of the board pen (see `boardSizes`).
 */
import type { PitchPoint } from "./pitch";
import type { BoardLine, LineTool } from "./scene";

import {
  curveHeadTail,
  dashPattern,
  DOT_HALO_SIZE,
  DOT_SIZE,
  STROKE_WIDTH_SCALE,
} from "@/features/player/telestration/geometry";
import { arrowBarbs, HALO_SPREAD } from "@/features/player/telestration/render";
import type { StrokeWidth } from "@/features/player/telestration/state";

/** The medium pen on the board, in metres: about a stick's length across. */
export const BOARD_PEN = 0.35;

/** A pen width step in metres, at a share `pen` of the board pen. */
export function boardPenWidth(width: StrokeWidth, pen = 1): number {
  return BOARD_PEN * pen * STROKE_WIDTH_SCALE[width];
}

function fmt(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** A bent line's quadratic Bezier: a curve, or a play line with three points. */
function lineCurve(
  line: Pick<BoardLine, "points">,
): { start: PitchPoint; control: PitchPoint; end: PitchPoint } | null {
  const [start, control, end] = line.points;
  if (line.points.length !== 3 || !start || !control || !end) return null;
  return { start, control, end };
}

/**
 * The line's body as an SVG path: straight, or the quadratic Bezier of a
 * bent line. The dribble's wave is drawn on top of this in {@link bodyPath};
 * this plain path is what a pointer hits and the selection outlines.
 */
export function linePath(line: Pick<BoardLine, "points">): string {
  const [start] = line.points;
  if (!start) return "";
  const curve = lineCurve(line);
  if (curve) {
    const { control, end } = curve;
    return `M${fmt(start.x)} ${fmt(start.y)}Q${fmt(control.x)} ${fmt(control.y)} ${fmt(end.x)} ${fmt(end.y)}`;
  }
  const end = line.points[line.points.length - 1] ?? start;
  return `M${fmt(start.x)} ${fmt(start.y)}L${fmt(end.x)} ${fmt(end.y)}`;
}

/**
 * The direction the line arrives in at its end: from `tail` to `tip`. A bent
 * line arrives along its end tangent, so a head or bar follows the bend.
 */
function endDirection(
  line: Pick<BoardLine, "points">,
): { tail: PitchPoint; tip: PitchPoint } | null {
  const curve = lineCurve(line);
  if (curve) return { tail: curveHeadTail(curve), tip: curve.end };
  const tail = line.points[0];
  const tip = line.points[line.points.length - 1];
  return tail && tip ? { tail, tip } : null;
}

/** Whether a tool ends in an arrowhead: every arrow and every play line but the block. */
function hasHead(tool: LineTool): boolean {
  return tool !== "line" && tool !== "block";
}

/** The two barb ends of the line's arrowhead, sized like telestration's. */
function barbs(
  line: Pick<BoardLine, "points" | "width">,
  pen: number,
): { tip: PitchPoint; left: PitchPoint; right: PitchPoint } | null {
  const direction = endDirection(line);
  if (!direction) return null;
  const { tail, tip } = direction;
  const [left, right] = arrowBarbs(
    tail,
    tip,
    boardPenWidth(line.width, pen),
    BOARD_PEN * pen,
  );
  return { tip, left, right };
}

/**
 * The arrowhead as a closed SVG path, or `null` for a plain line or a block.
 * A bent line's head points along its end tangent, so it follows the bend.
 */
export function arrowHeadPath(
  line: Pick<BoardLine, "tool" | "points" | "width">,
  pen = 1,
): string | null {
  if (!hasHead(line.tool)) return null;
  const head = barbs(line, pen);
  if (!head) return null;
  const { tip, left, right } = head;
  return `M${fmt(tip.x)} ${fmt(tip.y)}L${fmt(left.x)} ${fmt(left.y)}L${fmt(right.x)} ${fmt(right.y)}Z`;
}

/** How much wider a block's end bar is than an arrowhead, so it reads as a stop. */
const BAR_SPREAD = 1.6;

/**
 * A block's end: a bar across the line where it stops, a little wider than an
 * arrowhead on the same pen, as an open SVG path; `null` for any other tool.
 */
export function blockBarPath(
  line: Pick<BoardLine, "tool" | "points" | "width">,
  pen = 1,
): string | null {
  if (line.tool !== "block") return null;
  const head = barbs(line, pen);
  if (!head) return null;
  const { tip, left, right } = head;
  const half =
    (Math.hypot(right.x - left.x, right.y - left.y) / 2) * BAR_SPREAD;
  const across = unit({ x: right.x - left.x, y: right.y - left.y });
  if (!across) return null;
  const from = { x: tip.x - across.x * half, y: tip.y - across.y * half };
  const to = { x: tip.x + across.x * half, y: tip.y + across.y * half };
  return `M${fmt(from.x)} ${fmt(from.y)}L${fmt(to.x)} ${fmt(to.y)}`;
}

function unit(vector: PitchPoint): PitchPoint | null {
  const length = Math.hypot(vector.x, vector.y);
  return length === 0 ? null : { x: vector.x / length, y: vector.y / length };
}

/** A dribble's wave: one full swing every this many pen widths along the line. */
const WAVE_LENGTH = 6;
/** How far the wave swings to either side, in pen widths. */
const WAVE_AMPLITUDE = 1.2;
/** Points per swing of the wave: enough for a smooth curve at any size. */
const WAVE_SAMPLES = 12;
/** Points a bent line is followed through when a wave runs along it. */
const BASE_SAMPLES = 64;

/** The line followed as a fine polyline, with the length run at each point. */
function traced(line: Pick<BoardLine, "points">): {
  points: PitchPoint[];
  lengths: number[];
} {
  const curve = lineCurve(line);
  const start = line.points[0];
  const end = line.points[line.points.length - 1];
  const points: PitchPoint[] = [];
  if (curve) {
    for (let i = 0; i <= BASE_SAMPLES; i++) {
      const t = i / BASE_SAMPLES;
      const u = 1 - t;
      points.push({
        x:
          u * u * curve.start.x +
          2 * u * t * curve.control.x +
          t * t * curve.end.x,
        y:
          u * u * curve.start.y +
          2 * u * t * curve.control.y +
          t * t * curve.end.y,
      });
    }
  } else if (start && end) {
    points.push(start, end);
  }
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as PitchPoint;
    const b = points[i] as PitchPoint;
    lengths.push((lengths[i - 1] ?? 0) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return { points, lengths };
}

/** The point `distance` along a traced line, and the unit direction it runs in there. */
function alongTraced(
  { points, lengths }: { points: PitchPoint[]; lengths: number[] },
  distance: number,
): { at: PitchPoint; direction: PitchPoint } | null {
  for (let i = 1; i < points.length; i++) {
    const reached = lengths[i] ?? 0;
    if (reached < distance && i < points.length - 1) continue;
    const a = points[i - 1] as PitchPoint;
    const b = points[i] as PitchPoint;
    const before = lengths[i - 1] ?? 0;
    const share =
      reached === before ? 0 : (distance - before) / (reached - before);
    const direction = unit({ x: b.x - a.x, y: b.y - a.y });
    if (!direction) continue;
    return {
      at: { x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share },
      direction,
    };
  }
  return null;
}

/**
 * The body of a line as an SVG path. A dribble swings to and fro along its
 * line in whole waves, sized to the pen, and runs straight into its
 * arrowhead so the head sits clean; one too short for a single wave is drawn
 * plain. Every other line's body is {@link linePath}.
 */
export function bodyPath(
  line: Pick<BoardLine, "tool" | "points" | "width">,
  pen = 1,
): string {
  if (line.tool !== "dribble") return linePath(line);
  const base = traced(line);
  const total = base.lengths[base.lengths.length - 1] ?? 0;
  const head = barbs(line, pen);
  const end = line.points[line.points.length - 1];
  if (!head || !end) return linePath(line);
  const headLength = Math.hypot(
    head.tip.x - (head.left.x + head.right.x) / 2,
    head.tip.y - (head.left.y + head.right.y) / 2,
  );
  const width = Math.max(boardPenWidth(line.width, pen), BOARD_PEN * pen);
  const wave = width * WAVE_LENGTH;
  const waves = Math.floor((total - headLength) / wave);
  if (waves < 1) return linePath(line);
  const parts: string[] = [];
  for (let i = 0; i <= waves * WAVE_SAMPLES; i++) {
    const point = alongTraced(base, (i * wave) / WAVE_SAMPLES);
    if (!point) continue;
    const swing =
      width * WAVE_AMPLITUDE * Math.sin((2 * Math.PI * i) / WAVE_SAMPLES);
    const x = point.at.x - point.direction.y * swing;
    const y = point.at.y + point.direction.x * swing;
    parts.push(`${parts.length === 0 ? "M" : "L"}${fmt(x)} ${fmt(y)}`);
  }
  if (parts.length === 0) return linePath(line);
  const rest = lineCurve(line) ? restOfCurve(base, waves * wave) : [];
  for (const point of rest) parts.push(`L${fmt(point.x)} ${fmt(point.y)}`);
  parts.push(`L${fmt(end.x)} ${fmt(end.y)}`);
  return parts.join("");
}

/** The traced points of a bent line past `distance`, which the wave has left. */
function restOfCurve(
  { points, lengths }: { points: PitchPoint[]; lengths: number[] },
  distance: number,
): PitchPoint[] {
  return points.filter(
    (_, index) => (lengths[index] ?? 0) > distance && index < points.length - 1,
  );
}

/** Stroke settings for one layer (halo or pen) of a line's body. */
export interface BodyStroke {
  readonly width: number;
  /** The SVG `stroke-dasharray`, or `undefined` for a solid line. */
  readonly dash: string | undefined;
}

/**
 * The halo and pen strokes of a line's body. A dotted line draws round dots
 * (zero-length dashes with round caps) on the telestration rhythm, the halo
 * dots behind the pen dots on the same centres.
 */
export function bodyStrokes(
  line: Pick<BoardLine, "width" | "style">,
  pen = 1,
): {
  halo: BodyStroke;
  pen: BodyStroke;
} {
  const width = boardPenWidth(line.width, pen);
  if (line.style === "dotted") {
    const dash = dashPattern(width).map(fmt).join(" ");
    return {
      halo: { width: width * DOT_HALO_SIZE, dash },
      pen: { width: width * DOT_SIZE, dash },
    };
  }
  return {
    halo: { width: width * (1 + 2 * HALO_SPREAD), dash: undefined },
    pen: { width, dash: undefined },
  };
}

/** The halo width around an arrowhead or a block's bar, which are always drawn solid. */
export function headHaloWidth(line: Pick<BoardLine, "width">, pen = 1): number {
  return boardPenWidth(line.width, pen) * (1 + 2 * HALO_SPREAD);
}
