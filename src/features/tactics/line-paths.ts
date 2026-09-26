/**
 * The SVG geometry of a board line, in pitch metres, in the telestration look:
 * the same width steps, arrowhead, curved Schlenzer arrow, dot rhythm and dark
 * halo, taken from the telestration modules rather than redrawn here. Only the
 * pen's base width differs: telestration sizes it to the video picture, the
 * board to the pitch. A view that draws its tokens smaller draws its lines
 * with a share `pen` of the board pen (see `boardSizes`).
 */
import type { PitchPoint } from "./pitch";
import type { BoardLine } from "./scene";

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

/** The line's body as an SVG path: straight, or the curve's quadratic Bezier. */
export function linePath(line: Pick<BoardLine, "tool" | "points">): string {
  const [start, second, third] = line.points;
  if (!start) return "";
  if (line.tool === "curve" && second && third) {
    return `M${fmt(start.x)} ${fmt(start.y)}Q${fmt(second.x)} ${fmt(second.y)} ${fmt(third.x)} ${fmt(third.y)}`;
  }
  const end = line.points[line.points.length - 1] ?? start;
  return `M${fmt(start.x)} ${fmt(start.y)}L${fmt(end.x)} ${fmt(end.y)}`;
}

/**
 * The arrowhead as a closed SVG path, or `null` for a plain line. A curve's
 * head points along its end tangent, so it follows the bend.
 */
export function arrowHeadPath(
  line: Pick<BoardLine, "tool" | "points" | "width">,
  pen = 1,
): string | null {
  if (line.tool === "line") return null;
  const [start, second, third] = line.points;
  let tail: PitchPoint | undefined = start;
  let tip: PitchPoint | undefined = line.points[line.points.length - 1];
  if (line.tool === "curve" && start && second && third) {
    tail = curveHeadTail({ start, control: second, end: third });
    tip = third;
  }
  if (!tail || !tip) return null;
  const [left, right] = arrowBarbs(
    tail,
    tip,
    boardPenWidth(line.width, pen),
    BOARD_PEN * pen,
  );
  return `M${fmt(tip.x)} ${fmt(tip.y)}L${fmt(left.x)} ${fmt(left.y)}L${fmt(right.x)} ${fmt(right.y)}Z`;
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

/** The halo width around an arrowhead, which is always drawn solid. */
export function headHaloWidth(line: Pick<BoardLine, "width">, pen = 1): number {
  return boardPenWidth(line.width, pen) * (1 + 2 * HALO_SPREAD);
}
