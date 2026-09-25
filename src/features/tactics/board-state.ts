/**
 * The tactics board editor as a pure reducer: the scene being edited, what is
 * selected, the drawing pen, the line being dragged out, and the undo history.
 * Free of React and the DOM so the editing rules are unit-tested on their own.
 */
import { clampToBoard, roundPoint } from "./geometry";
import type { PitchPoint } from "./pitch";
import {
  MAX_LINES,
  MAX_TOKENS,
  nextId,
  spawnPoint,
  type BoardLine,
  type BoardToken,
  type LineTool,
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

export interface BoardState {
  readonly scene: TacticsScene;
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
  | { readonly type: "undo" };

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

function placed(token: BoardToken, at: PitchPoint): BoardToken {
  return { ...token, ...roundPoint(clampToBoard(at)) };
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
  state: BoardState,
  action: BoardAction,
): BoardState {
  const { scene } = state;
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id };
    case "grab":
      return { ...state, selectedId: action.id, grabbed: action.id };
    case "drag": {
      const moved = mapToken(scene, action.id, (token) =>
        placed(token, action.to),
      );
      // A whole drag is one undo step: its first move remembers the scene as
      // it was before, so pressing a token without moving it adds no step.
      return state.grabbed === action.id
        ? { ...commit(state, moved), grabbed: null }
        : { ...state, scene: moved };
    }
    case "nudge":
      if (!scene.tokens.some((token) => token.id === action.id)) return state;
      return commit(
        state,
        mapToken(scene, action.id, (token) =>
          placed(token, {
            x: token.x + action.by.x,
            y: token.y + action.by.y,
          }),
        ),
      );
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
      return {
        ...commit(state, { ...scene, tokens, lines }),
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
    case "clearLines":
      if (scene.lines.length === 0) return state;
      return commit(state, { ...scene, lines: [] });
    case "undo": {
      if (state.draft) return { ...state, draft: null };
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        scene: previous,
        past: state.past.slice(0, -1),
        selectedId: null,
      };
    }
  }
}
