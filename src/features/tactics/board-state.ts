/**
 * The tactics board editor as a pure reducer: the scene being edited, the step
 * on show, what is selected, the drawing pen, the line being dragged out, the
 * undo history, and the playback of the animation. Free of React and the DOM
 * so the editing rules are unit-tested on their own.
 */
import {
  DEFAULT_STEP_DURATION,
  keyframePositions,
  keyframeTimes,
  linesForStep,
  sceneDuration,
  stepAtTime,
} from "./animation";
import { clampToBoard, roundPoint } from "./geometry";
import type { PitchPoint } from "./pitch";
import {
  MAX_LINES,
  MAX_STEPS,
  MAX_TOKENS,
  nextId,
  spawnPoint,
  type BoardLine,
  type BoardToken,
  type LineTool,
  type SceneStep,
  type StepMove,
  type TacticsScene,
  type Team,
} from "./scene";

import { curveThrough } from "@/features/player/telestration/geometry";
import type {
  LineStyle,
  PenColor,
  StrokeWidth,
} from "@/features/player/telestration/state";

/** What a pointer drag on the board does: move tokens, or draw a kind of line. */
export type BoardMode = "move" | LineTool;

/**
 * The animation between keyframes: the time in seconds it shows, and whether
 * it runs. Paused partway it still shows that moment.
 */
export interface Playback {
  readonly time: number;
  readonly playing: boolean;
}

export interface BoardState {
  readonly scene: TacticsScene;
  /**
   * The step the board rests on and edits: `0` is the start arrangement.
   * While {@link playback} is set the board shows that moment instead.
   */
  readonly step: number;
  /** The animation on show, or `null` while the board rests on {@link step}. */
  readonly playback: Playback | null;
  /** The playback speed, a factor of real time. */
  readonly speed: number;
  /** The selected token or line id. */
  readonly selectedId: string | null;
  readonly mode: BoardMode;
  readonly color: PenColor;
  readonly width: StrokeWidth;
  readonly lineStyle: LineStyle;
  /** The line under the pointer, holding every sampled point until released. */
  readonly draft: BoardLine | null;
  /** Earlier scenes, oldest first; undo restores the last. */
  readonly past: readonly TacticsScene[];
  /** The token just pressed, until its first move makes the drag an undo step. */
  readonly grabbed: string | null;
}

export type BoardAction =
  | { readonly type: "select"; readonly id: string | null }
  | { readonly type: "grab"; readonly id: string }
  | { readonly type: "drag"; readonly id: string; readonly to: PitchPoint }
  | { readonly type: "nudge"; readonly id: string; readonly by: PitchPoint }
  | { readonly type: "addPlayer"; readonly team: Team }
  | { readonly type: "addBall" }
  | { readonly type: "remove"; readonly id: string }
  | {
      readonly type: "setLabel";
      readonly id: string;
      readonly label: string;
      readonly playerId: string | null;
    }
  | { readonly type: "setMode"; readonly mode: BoardMode }
  | { readonly type: "setColor"; readonly color: PenColor }
  | { readonly type: "setWidth"; readonly width: StrokeWidth }
  | { readonly type: "toggleLineStyle" }
  | { readonly type: "lineBegin"; readonly at: PitchPoint }
  | { readonly type: "lineExtend"; readonly at: PitchPoint }
  | { readonly type: "lineEnd" }
  | { readonly type: "lineCancel" }
  | { readonly type: "clearLines" }
  | { readonly type: "undo" }
  | { readonly type: "goToStep"; readonly step: number }
  | { readonly type: "addStep" }
  | { readonly type: "removeStep" }
  | { readonly type: "setDuration"; readonly duration: number }
  | { readonly type: "bend"; readonly id: string; readonly via: PitchPoint }
  | { readonly type: "straighten"; readonly id: string }
  | { readonly type: "resetMove"; readonly id: string }
  | { readonly type: "play" }
  | { readonly type: "pause" }
  | { readonly type: "restart" }
  | { readonly type: "tick"; readonly seconds: number }
  | { readonly type: "seek"; readonly time: number }
  | { readonly type: "stepBack" }
  | { readonly type: "stepForward" }
  | { readonly type: "setSpeed"; readonly speed: number };

/**
 * Actions that leave a running animation alone. Every other action edits the
 * board, so it first brings the board back to rest on a step.
 */
const PASSIVE_ACTIONS: ReadonlySet<BoardAction["type"]> = new Set([
  "play",
  "pause",
  "restart",
  "tick",
  "seek",
  "stepBack",
  "stepForward",
  "setSpeed",
  "setColor",
  "setWidth",
  "toggleLineStyle",
]);

/** How many steps undo reaches back. */
export const MAX_HISTORY = 50;

/**
 * The shortest line kept, in metres: a shorter drag is a click, and would
 * leave a stray arrowhead on the board.
 */
export const MIN_LINE_LENGTH = 0.5;

export function initialBoardState(scene: TacticsScene): BoardState {
  return {
    scene,
    step: 0,
    playback: null,
    speed: 1,
    selectedId: null,
    mode: "move",
    color: "white",
    width: "medium",
    lineStyle: "solid",
    draft: null,
    past: [],
    grabbed: null,
  };
}

/** Replace the scene, remembering the old one for undo. */
function commit(state: BoardState, scene: TacticsScene): BoardState {
  return {
    ...state,
    scene,
    past: [...state.past, state.scene].slice(-MAX_HISTORY),
  };
}

function mapToken(
  scene: TacticsScene,
  id: string,
  update: (token: BoardToken) => BoardToken,
): TacticsScene {
  return {
    ...scene,
    tokens: scene.tokens.map((token) =>
      token.id === id ? update(token) : token,
    ),
  };
}

function placed(at: PitchPoint): PitchPoint {
  return roundPoint(clampToBoard(at));
}

function mapStep(
  scene: TacticsScene,
  step: number,
  update: (current: SceneStep) => SceneStep,
): TacticsScene {
  return {
    ...scene,
    steps: scene.steps.map((current, index) =>
      index === step - 1 ? update(current) : current,
    ),
  };
}

/** The token's move in a step (1 to n), if it runs in it. */
export function moveIn(
  scene: TacticsScene,
  step: number,
  id: string,
): StepMove | undefined {
  return scene.steps[step - 1]?.moves.find((move) => move.token === id);
}

/**
 * Put a token at a point on a step. On step 0 that is its start position;
 * on a later step it is where the step runs it to, and a run that ends where
 * it started is no run at all.
 */
function placeOnStep(
  scene: TacticsScene,
  step: number,
  id: string,
  to: PitchPoint,
): TacticsScene {
  const at = placed(to);
  if (step === 0) return mapToken(scene, id, (token) => ({ ...token, ...at }));
  const from = keyframePositions(scene, step - 1).get(id);
  if (!from) return scene;
  return mapStep(scene, step, (current) => {
    const others = current.moves.filter((move) => move.token !== id);
    if (from.x === at.x && from.y === at.y) {
      return { ...current, moves: others };
    }
    const via = moveIn(scene, step, id)?.via ?? null;
    return { ...current, moves: [...others, { token: id, ...at, via }] };
  });
}

/** Where a token stands on the step the board rests on. */
function positionOnStep(state: BoardState, id: string): PitchPoint | undefined {
  return keyframePositions(state.scene, state.step).get(id);
}

/** Rest on a step, dropping a selected line the step does not show. */
function restOn(state: BoardState, step: number): BoardState {
  const clamped = Math.min(Math.max(step, 0), state.scene.steps.length);
  const shown = linesForStep(state.scene, clamped);
  const keepsSelection =
    state.scene.tokens.some((token) => token.id === state.selectedId) ||
    shown.some((line) => line.id === state.selectedId);
  return {
    ...state,
    step: clamped,
    playback: null,
    draft: null,
    selectedId: keepsSelection ? state.selectedId : null,
  };
}

/** Show a moment of the animation; a keyframe's moment rests on its step. */
function showTime(
  state: BoardState,
  time: number,
  playing: boolean,
): BoardState {
  const total = sceneDuration(state.scene);
  const clamped = Math.min(Math.max(time, 0), total);
  const step = keyframeTimes(state.scene).findIndex(
    (at) => Math.abs(at - clamped) < 1e-6,
  );
  if (!playing && step !== -1) return restOn(state, step);
  return { ...state, playback: { time: clamped, playing } };
}

/** Advance or rewind a step from what is on show now. */
function stepBy(state: BoardState, direction: 1 | -1): BoardState {
  const { playback, scene } = state;
  if (!playback) return restOn(state, state.step + direction);
  // Partway through step k: back rests on where it started, forward on
  // where it arrives.
  const step = stepAtTime(scene, playback.time);
  return restOn(state, direction === 1 ? step : step - 1);
}

/** Whether a released draft reaches far enough to be a line. */
function isKeptLine(line: BoardLine): boolean {
  const xs = line.points.map((point) => point.x);
  const ys = line.points.map((point) => point.y);
  return (
    Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ) >= MIN_LINE_LENGTH
  );
}

/** A released draft as stored: two ends, or a curve's start, control and end. */
function finishLine(draft: BoardLine): BoardLine | null {
  if (!isKeptLine(draft)) return null;
  const start = draft.points[0];
  const end = draft.points[draft.points.length - 1];
  if (!start || !end) return null;
  if (draft.tool !== "curve") return { ...draft, points: [start, end] };
  const curve = curveThrough(draft.points);
  if (!curve) return null;
  return {
    ...draft,
    points: [curve.start, roundPoint(curve.control), curve.end],
  };
}

export function boardReducer(
  current: BoardState,
  action: BoardAction,
): BoardState {
  // An edit during the animation lands on the step on show.
  const state =
    current.playback && !PASSIVE_ACTIONS.has(action.type)
      ? restOn(current, stepAtTime(current.scene, current.playback.time))
      : current;
  const { scene } = state;
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id };
    case "grab":
      return { ...state, selectedId: action.id, grabbed: action.id };
    case "drag": {
      const moved = placeOnStep(scene, state.step, action.id, action.to);
      // A whole drag is one undo step: its first move remembers the scene as
      // it was before, so pressing a token without moving it adds no step.
      return state.grabbed === action.id
        ? { ...commit(state, moved), grabbed: null }
        : { ...state, scene: moved };
    }
    case "nudge": {
      const at = positionOnStep(state, action.id);
      if (!at) return state;
      return commit(
        state,
        placeOnStep(scene, state.step, action.id, {
          x: at.x + action.by.x,
          y: at.y + action.by.y,
        }),
      );
    }
    case "addPlayer": {
      if (scene.tokens.length >= MAX_TOKENS) return state;
      const id = nextId(scene, "p");
      const number =
        scene.tokens.filter(
          (token) => token.kind === "player" && token.team === action.team,
        ).length + 1;
      const token: BoardToken = {
        id,
        kind: "player",
        team: action.team,
        label: String(number),
        playerId: null,
        ...spawnPoint(action.team),
      };
      return {
        ...commit(state, { ...scene, tokens: [...scene.tokens, token] }),
        selectedId: id,
      };
    }
    case "addBall": {
      const hasBall = scene.tokens.some((token) => token.kind === "ball");
      if (hasBall || scene.tokens.length >= MAX_TOKENS) return state;
      const id = nextId(scene, "b");
      const ball: BoardToken = { id, kind: "ball", ...spawnPoint("ball") };
      return {
        ...commit(state, { ...scene, tokens: [...scene.tokens, ball] }),
        selectedId: id,
      };
    }
    case "remove": {
      const tokens = scene.tokens.filter((token) => token.id !== action.id);
      const lines = scene.lines.filter((line) => line.id !== action.id);
      if (
        tokens.length === scene.tokens.length &&
        lines.length === scene.lines.length
      )
        return state;
      // A removed token leaves every step it ran in.
      const steps = scene.steps.map((step) => ({
        ...step,
        moves: step.moves.filter((move) => move.token !== action.id),
      }));
      return {
        ...commit(state, { ...scene, tokens, lines, steps }),
        selectedId: null,
      };
    }
    case "setLabel":
      return commit(
        state,
        mapToken(scene, action.id, (token) =>
          token.kind === "player"
            ? { ...token, label: action.label, playerId: action.playerId }
            : token,
        ),
      );
    case "setMode":
      return { ...state, mode: action.mode, draft: null };
    case "setColor":
      return { ...state, color: action.color };
    case "setWidth":
      return { ...state, width: action.width };
    case "toggleLineStyle":
      return {
        ...state,
        lineStyle: state.lineStyle === "solid" ? "dotted" : "solid",
      };
    case "lineBegin":
      if (state.mode === "move" || scene.lines.length >= MAX_LINES)
        return state;
      return {
        ...state,
        selectedId: null,
        draft: {
          id: nextId(scene, "l"),
          tool: state.mode,
          color: state.color,
          width: state.width,
          style: state.lineStyle,
          points: [roundPoint(action.at)],
          step: state.step,
        },
      };
    case "lineExtend": {
      const { draft } = state;
      if (!draft) return state;
      const at = roundPoint(action.at);
      // A straight line only needs its two ends; a curve keeps the whole drag
      // so it can bend through the point farthest from the straight line.
      const points =
        draft.tool === "curve"
          ? [...draft.points, at]
          : [draft.points[0] ?? at, at];
      return { ...state, draft: { ...draft, points } };
    }
    case "lineEnd": {
      const { draft } = state;
      if (!draft) return state;
      const line = finishLine(draft);
      const next = { ...state, draft: null };
      return line
        ? commit(next, { ...scene, lines: [...scene.lines, line] })
        : next;
    }
    case "lineCancel":
      return state.draft ? { ...state, draft: null } : state;
    case "clearLines": {
      // Only the step's own lines: step 0's show on every step.
      const lines = scene.lines.filter((line) => line.step !== state.step);
      if (lines.length === scene.lines.length) return state;
      return commit(state, { ...scene, lines });
    }
    case "undo": {
      if (state.draft) return { ...state, draft: null };
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        scene: previous,
        step: Math.min(state.step, previous.steps.length),
        past: state.past.slice(0, -1),
        selectedId: null,
      };
    }
    case "goToStep":
      return restOn(state, action.step);
    case "addStep": {
      if (scene.steps.length >= MAX_STEPS) return state;
      // The new step comes right after the one on show; later steps and
      // their lines move one along.
      const at = state.step;
      const steps = [
        ...scene.steps.slice(0, at),
        { duration: DEFAULT_STEP_DURATION, moves: [] },
        ...scene.steps.slice(at),
      ];
      const lines = scene.lines.map((line) =>
        line.step > at ? { ...line, step: line.step + 1 } : line,
      );
      return restOn(commit(state, { ...scene, steps, lines }), at + 1);
    }
    case "removeStep": {
      const at = state.step;
      if (at === 0) return state;
      const steps = scene.steps.filter((_, index) => index !== at - 1);
      const lines = scene.lines
        .filter((line) => line.step !== at)
        .map((line) =>
          line.step > at ? { ...line, step: line.step - 1 } : line,
        );
      return restOn(commit(state, { ...scene, steps, lines }), at - 1);
    }
    case "setDuration":
      if (state.step === 0) return state;
      return commit(
        state,
        mapStep(scene, state.step, (current) => ({
          ...current,
          duration: action.duration,
        })),
      );
    case "bend": {
      if (!moveIn(scene, state.step, action.id)) return state;
      const bent = mapStep(scene, state.step, (current) => ({
        ...current,
        moves: current.moves.map((move) =>
          move.token === action.id
            ? { ...move, via: placed(action.via) }
            : move,
        ),
      }));
      // Like a drag, a whole bend is one undo step.
      return state.grabbed === action.id
        ? { ...commit(state, bent), grabbed: null }
        : { ...state, scene: bent };
    }
    case "straighten":
      if (!moveIn(scene, state.step, action.id)?.via) return state;
      return commit(
        state,
        mapStep(scene, state.step, (current) => ({
          ...current,
          moves: current.moves.map((move) =>
            move.token === action.id ? { ...move, via: null } : move,
          ),
        })),
      );
    case "resetMove":
      if (!moveIn(scene, state.step, action.id)) return state;
      return commit(
        state,
        mapStep(scene, state.step, (current) => ({
          ...current,
          moves: current.moves.filter((move) => move.token !== action.id),
        })),
      );
    case "play": {
      const total = sceneDuration(scene);
      if (total === 0 || state.playback?.playing) return state;
      // Carry on from a paused moment, or from the step on show; at the end
      // it starts over.
      const from =
        state.playback?.time ?? keyframeTimes(scene)[state.step] ?? 0;
      return {
        ...state,
        selectedId: null,
        draft: null,
        playback: { time: from >= total ? 0 : from, playing: true },
      };
    }
    case "pause":
      return state.playback?.playing
        ? { ...state, playback: { ...state.playback, playing: false } }
        : state;
    case "restart":
      if (sceneDuration(scene) === 0) return state;
      return {
        ...state,
        selectedId: null,
        draft: null,
        playback: { time: 0, playing: true },
      };
    case "tick": {
      const { playback } = state;
      if (!playback?.playing) return state;
      const time = playback.time + action.seconds * state.speed;
      // At the end the board rests on the last step, ready to edit.
      if (time >= sceneDuration(scene))
        return restOn(state, scene.steps.length);
      return { ...state, playback: { time, playing: true } };
    }
    case "seek":
      return showTime(state, action.time, false);
    case "stepBack":
      return stepBy(state, -1);
    case "stepForward":
      return stepBy(state, 1);
    case "setSpeed":
      return { ...state, speed: action.speed };
  }
}
