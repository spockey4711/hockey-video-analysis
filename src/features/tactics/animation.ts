/**
 * The animation engine (ADR 0012): a pure function from a scene and a time to
 * what the board shows then. Step 0 is the start arrangement; each step after
 * it moves some tokens from where the step before left them, over its
 * duration, eased in and out, straight or bent through the move's `via`, and
 * then holds still for the step's hold before the next step begins.
 *
 * Free of React and the DOM, so the editor, presentation mode and any other
 * player of the scene format draw exactly the same frames.
 */
import type { PitchPoint } from "./pitch";
import type {
  BoardLine,
  BoardShape,
  BoardToken,
  StepMove,
  TacticsScene,
} from "./scene";

/** A new step's move time, in seconds. */
export const DEFAULT_STEP_DURATION = 2;

/** The move times the step bar offers, in seconds. */
export const STEP_DURATIONS: readonly number[] = [
  0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10,
];

/** The holds after a step the steps bar offers, in seconds; `0` is none. */
export const STEP_HOLDS: readonly number[] = [
  0, 0.5, 1, 1.5, 2, 3, 4, 5, 8, 10,
];

/**
 * What the board shows at one moment: tokens where they stand, and the lines,
 * zones and texts on show.
 */
export interface SceneFrame {
  /** The step on show: the one moving, or the one the board rests on. */
  readonly step: number;
  readonly tokens: readonly BoardToken[];
  readonly lines: readonly BoardLine[];
  readonly shapes: readonly BoardShape[];
  /** The caption of the step on show, `""` for none. */
  readonly caption: string;
}

/** A run's path as a quadratic Bezier: start, control point and end. */
export interface MovePath {
  readonly start: PitchPoint;
  readonly control: PitchPoint;
  readonly end: PitchPoint;
}

/**
 * When each step starts moving, in seconds from the start: `[s1, ..., sn]`.
 * A step starts once the step before has arrived and held for its hold.
 */
export function stepStartTimes(scene: TacticsScene): number[] {
  const starts: number[] = [];
  let total = 0;
  for (const step of scene.steps) {
    starts.push(total);
    total += step.duration + step.hold;
  }
  return starts;
}

/**
 * When the board comes to rest on each step, in seconds from the start:
 * `[0, t1, ..., tn]`, where step `k` moves from its start to `tk` and then
 * holds still for its hold.
 */
export function keyframeTimes(scene: TacticsScene): number[] {
  const starts = stepStartTimes(scene);
  return [
    0,
    ...scene.steps.map((step, index) => (starts[index] ?? 0) + step.duration),
  ];
}

/** How long the whole animation plays, holds included, in seconds. */
export function sceneDuration(scene: TacticsScene): number {
  return scene.steps.reduce(
    (total, step) => total + step.duration + step.hold,
    0,
  );
}

/**
 * The step on show at a time: `0` at the start, and `k` while step `k` moves,
 * at the moment it arrives and while it holds, so a step's lines and caption
 * stay up until the next step begins.
 */
export function stepAtTime(scene: TacticsScene, time: number): number {
  if (time <= 0) return 0;
  const starts = stepStartTimes(scene);
  for (let step = 1; step < starts.length; step += 1) {
    if (time <= (starts[step] ?? 0)) return step;
  }
  return scene.steps.length;
}

/** Whether a time falls in a step's hold: arrived, the next step not yet begun. */
export function isHolding(scene: TacticsScene, time: number): boolean {
  const step = stepAtTime(scene, time);
  if (step === 0) return false;
  return time >= (keyframeTimes(scene)[step] ?? 0) - 1e-6;
}

/** The caption under the board while a step is on show; `""` for none. */
export function captionForStep(scene: TacticsScene, step: number): string {
  if (step <= 0) return scene.startCaption;
  return scene.steps[step - 1]?.caption ?? "";
}

/**
 * The caption on show: at a moment of the animation while it plays or is
 * paused (`time`), or on the step the board rests on when `time` is `null`.
 */
export function captionOnShow(
  scene: TacticsScene,
  step: number,
  time: number | null,
): string {
  return captionForStep(scene, time === null ? step : stepAtTime(scene, time));
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

/** Whether a line or shape of `own` step shows while `step` is on show. */
export function showsOnStep(own: number, step: number): boolean {
  return own === 0 || own === step;
}

/** The lines on show while a step is: step 0's throughout, plus the step's own. */
export function linesForStep(
  scene: TacticsScene,
  step: number,
): readonly BoardLine[] {
  return scene.lines.filter((line) => showsOnStep(line.step, step));
}

/** The zones and texts on show while a step is, like its lines. */
export function shapesForStep(
  scene: TacticsScene,
  step: number,
): readonly BoardShape[] {
  return scene.shapes.filter((shape) => showsOnStep(shape.step, step));
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
    shapes: shapesForStep(scene, clamped),
    caption: captionForStep(scene, clamped),
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
  const start = stepStartTimes(scene)[step - 1] ?? 0;
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
    shapes: shapesForStep(scene, step),
    caption: captionForStep(scene, step),
  };
}
