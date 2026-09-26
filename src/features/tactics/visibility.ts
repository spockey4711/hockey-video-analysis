/**
 * What of a frame shows on the part of the pitch on screen. A short-corner
 * quarter hides the tokens and lines that lie wholly outside it; they stay in
 * the scene and come back on the whole pitch. Only what shows can be picked,
 * one by one or with a box dragged around it.
 */
import type { SceneFrame } from "./animation";
import { overlapsBounds } from "./geometry";
import type { PitchBounds, PitchPoint } from "./pitch";

/**
 * The frame without the tokens and lines wholly outside the bounds. A token
 * whose disc reaches in, or a line any of whose box reaches in, stays and is
 * clipped at the edge.
 */
export function visibleFrame(
  frame: SceneFrame,
  bounds: PitchBounds,
  /** The largest token radius in the view, so a disc that reaches in shows. */
  reach: number,
): SceneFrame {
  return {
    ...frame,
    tokens: frame.tokens.filter((token) =>
      overlapsBounds([token], bounds, reach),
    ),
    lines: frame.lines.filter((line) =>
      overlapsBounds(line.points, bounds, reach),
    ),
  };
}

/**
 * The tokens and lines a box dragged between two corners takes in: a token
 * whose centre lies inside it, a line whose ends both do. Ids come tokens
 * first, each in the frame's order.
 */
export function itemsInBox(
  frame: SceneFrame,
  corner: PitchPoint,
  opposite: PitchPoint,
): string[] {
  const minX = Math.min(corner.x, opposite.x);
  const maxX = Math.max(corner.x, opposite.x);
  const minY = Math.min(corner.y, opposite.y);
  const maxY = Math.max(corner.y, opposite.y);
  const inside = (point: PitchPoint) =>
    point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  return [
    ...frame.tokens.filter(inside),
    ...frame.lines.filter((line) => {
      const start = line.points[0];
      const end = line.points[line.points.length - 1];
      return start && end && inside(start) && inside(end);
    }),
  ].map((item) => item.id);
}
