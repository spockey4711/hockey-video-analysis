/**
 * What of a frame shows on the part of the pitch on screen. A short-corner
 * quarter hides the tokens, lines and shapes that lie wholly outside it; they stay in
 * the scene and come back on the whole pitch. Only what shows can be picked,
 * one by one or with a box dragged around it.
 */
import type { SceneFrame } from "./animation";
import { overlapsBounds } from "./geometry";
import type { PitchBounds, PitchPoint } from "./pitch";
import { isZone } from "./scene";

/**
 * The frame without the tokens, lines and shapes wholly outside the bounds. A
 * token whose disc reaches in, or a line or zone any of whose box reaches in,
 * stays and is clipped at the edge; a text stays while its point lies within
 * `reach` of them.
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
    shapes: frame.shapes.filter((shape) =>
      overlapsBounds(isZone(shape) ? shape.points : [shape], bounds, reach),
    ),
  };
}

/**
 * The tokens, lines and shapes a box dragged between two corners takes in: a
 * token or text whose point lies inside it, a line whose ends both do, a zone
 * whose corners all do. Ids come tokens first, then lines, then shapes, each
 * in the frame's order.
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
    ...frame.shapes.filter((shape) =>
      isZone(shape) ? shape.points.every(inside) : inside(shape),
    ),
  ].map((item) => item.id);
}
