/**
 * Mirror a scene: the same play on the other wing, or towards the other goal.
 * A pure transform over every position the scene holds (tokens, every line's
 * points including a curve's control point, and each step's run targets and
 * bends), so a formation or a corner variant is authored once and flipped.
 *
 * The board and the pitch markings are symmetric about the centre spot, so a
 * mirrored point stays on the board and a mirrored scene draws on the same
 * markings. Only the positions change: ids, steps and the lines' direction
 * stay as they were.
 */
import { roundPoint, type Turn } from "./geometry";
import {
  PITCH_LENGTH,
  PITCH_WIDTH,
  type PitchPoint,
  type PitchView,
} from "./pitch";
import type { TacticsScene } from "./scene";

/**
 * The pitch coordinate a mirror flips: `x` swaps the ends (the left goal's
 * side becomes the right's), `y` swaps the wings (the top side-line's side
 * becomes the bottom's).
 */
export type MirrorAxis = "x" | "y";

/**
 * The axes a view can be mirrored along. The short-corner quarter shows one
 * goal, so it only swaps the wings: swapping the ends would carry the whole
 * scene out of the quarter.
 */
export function mirrorAxes(view: PitchView): readonly MirrorAxis[] {
  return view === "full" ? ["x", "y"] : ["y"];
}

/** How a mirror looks on screen: the board flips left-right or top-bottom. */
export type ScreenFlip = "horizontal" | "vertical";

/**
 * Which way a mirror along a pitch axis flips the board on screen. Unturned,
 * the pitch's `x` runs across the screen; turned a quarter either way, its
 * `y` does.
 */
export function screenFlip(axis: MirrorAxis, turn: Turn): ScreenFlip {
  const across = turn === "none" ? "x" : "y";
  return axis === across ? "horizontal" : "vertical";
}

function mirrorPoint<T extends PitchPoint>(point: T, axis: MirrorAxis): T {
  const flipped =
    axis === "x"
      ? { x: PITCH_LENGTH - point.x, y: point.y }
      : { x: point.x, y: PITCH_WIDTH - point.y };
  return { ...point, ...roundPoint(flipped) };
}

/** The scene mirrored along an axis; a view that cannot take it comes back as it was. */
export function mirrorScene(
  scene: TacticsScene,
  axis: MirrorAxis,
): TacticsScene {
  if (!mirrorAxes(scene.view).includes(axis)) return scene;
  return {
    ...scene,
    tokens: scene.tokens.map((token) => mirrorPoint(token, axis)),
    lines: scene.lines.map((line) => ({
      ...line,
      points: line.points.map((point) => mirrorPoint(point, axis)),
    })),
    steps: scene.steps.map((step) => ({
      ...step,
      moves: step.moves.map((move) => ({
        ...mirrorPoint(move, axis),
        via: move.via && mirrorPoint(move.via, axis),
      })),
    })),
  };
}
