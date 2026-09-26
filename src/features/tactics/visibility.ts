/**
 * What of a frame shows on the part of the pitch on screen. A short-corner
 * quarter hides the tokens and lines that lie wholly outside it; they stay in
 * the scene and come back on the whole pitch.
 */
import type { SceneFrame } from "./animation";
import { overlapsBounds } from "./geometry";
import type { PitchBounds } from "./pitch";

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
