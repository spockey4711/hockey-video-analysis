/**
 * The animation engine (ADR 0011): a pure function from a scene and a time to
 * what the board shows then. Step 0 is the start arrangement; each step after
 * it moves some tokens from where the step before left them, over its
 * duration, eased in and out, straight or bent through the move's `via`.
 *
 * Free of React and the DOM, so the editor, presentation mode and any other
 * player of the scene format draw exactly the same frames.
 */
import type { PitchPoint } from "./pitch";
import type { BoardLine, BoardToken, StepMove, TacticsScene } from "./scene";

/** A new step's move time, in seconds. */
export const DEFAULT_STEP_DURATION = 2;

/** The move times the step bar offers, in seconds. */
export const STEP_DURATIONS: readonly number[] = [
  0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10,
];

/** What the board shows at one moment: tokens where they stand, and the lines on show. */
export interface SceneFrame {
  /** The step on show: the one moving, or the one the board rests on. */
  readonly step: number;
  readonly tokens: readonly BoardToken[];
  readonly lines: readonly BoardLine[];
}

/** A run's path as a quadratic Bezier: start, control point and end. */
export interface MovePath {
  readonly start: PitchPoint;
  readonly control: PitchPoint;
  readonly end: PitchPoint;
}

/**
 * When the board rests on each step, in seconds from the start:
 * `[0, t1, ..., tn]`, where step `k` moves from `t(k-1)` to `tk`.
 */
export function keyframeTimes(scene: TacticsScene): number[] {
  const times = [0];
  let total = 0;
  for (const step of scene.steps) {
    total += step.duration;
    times.push(total);
  }
  return times;
}

/** How long the whole animation plays, in seconds. */
export function sceneDuration(scene: TacticsScene): number {
  return scene.steps.reduce((total, step) => total + step.duration, 0);
}

/**
 * The step on show at a time: `0` at the start, and `k` while step `k` moves
 * and at the moment it arrives, so a step's lines stay up until the next step
 * begins.
 */
export function stepAtTime(scene: TacticsScene, time: number): number {
  const times = keyframeTimes(scene);
  for (let step = 1; step < times.length; step += 1) {
    if (time <= (times[step] ?? 0)) return time <= 0 ? 0 : step;
  }
  return scene.steps.length;
}

/** Where every token stands once the board rests on a step. */
export function keyframePositions(
  scene: TacticsScene,
  step: number,
): Map<string, PitchPoint> {
  const positions = new Map<string, PitchPoint>(
    scene.tokens.map((token) => [token.id, { x: token.x, y: token.y }]),
  );
  for (const current of scene.steps.slice(0, Math.max(step, 0))) {
    for (const move of current.moves) {
      positions.set(move.token, { x: move.x, y: move.y });
    }
  }
  return positions;
}

/**
 * The path of a run from `from` to the move's target. A straight run keeps
 * its control point halfway, so it moves along the line; a bent one puts it
 * where the curve passes through `via` halfway.
 */
export function movePath(from: PitchPoint, move: StepMove): MovePath {
  const end = { x: move.x, y: move.y };
  const mid = { x: (from.x + end.x) / 2, y: (from.y + end.y) / 2 };
  const via = move.via ?? mid;
  return {
    start: from,
    control: { x: 2 * via.x - mid.x, y: 2 * via.y - mid.y },
    end,
  };
}

/** The point on a path at progress `t` from 0 (start) to 1 (end). */
export function pointOnPath(path: MovePath, t: number): PitchPoint {
  const a = (1 - t) * (1 - t);
  const b = 2 * t * (1 - t);
  const c = t * t;
  return {
    x: a * path.start.x + b * path.control.x + c * path.end.x,
    y: a * path.start.y + b * path.control.y + c * path.end.y,
  };
}

/** Ease in and out, so a run starts and stops gently rather than jerking. */
export function ease(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

/** The lines on show while a step is: step 0's throughout, plus the step's own. */
export function linesForStep(
  scene: TacticsScene,
  step: number,
): readonly BoardLine[] {
  return scene.lines.filter((line) => line.step === 0 || line.step === step);
}

function placeTokens(
  scene: TacticsScene,
  positions: ReadonlyMap<string, PitchPoint>,
): BoardToken[] {
  return scene.tokens.map((token) => {
    const at = positions.get(token.id);
    return at ? { ...token, x: at.x, y: at.y } : token;
  });
}

/** The board at rest on a step. */
export function keyframe(scene: TacticsScene, step: number): SceneFrame {
  const clamped = Math.min(Math.max(step, 0), scene.steps.length);
  return {
    step: clamped,
    tokens: placeTokens(scene, keyframePositions(scene, clamped)),
    lines: linesForStep(scene, clamped),
  };
}

/**
 * The board at a time in seconds, clamped to the animation: a step's moving
 * tokens partway along their runs, everything else where it rests.
 */
export function frameAt(scene: TacticsScene, time: number): SceneFrame {
  const step = stepAtTime(scene, time);
  const current = scene.steps[step - 1];
  if (!current) return keyframe(scene, step);
  const start = keyframeTimes(scene)[step - 1] ?? 0;
  const progress = ease((time - start) / current.duration);
  const positions = keyframePositions(scene, step - 1);
  for (const move of current.moves) {
    const from = positions.get(move.token);
    if (from)
      positions.set(move.token, pointOnPath(movePath(from, move), progress));
  }
  return {
    step,
    tokens: placeTokens(scene, positions),
    lines: linesForStep(scene, step),
  };
}
