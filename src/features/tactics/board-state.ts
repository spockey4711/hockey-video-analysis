/**
 * The tactics board editor as a pure reducer: the scene being edited, the step
 * on show, what is selected, the drawing pen, the line or zone being dragged
 * out, the undo and redo history, and the playback of the animation. Free of
 * React and the DOM so the editing rules are unit-tested on their own.
 */
import {
  captionForStep,
  DEFAULT_STEP_DURATION,
  keyframePositions,
  isHolding,
  linesForStep,
  sceneDuration,
  shapesForStep,
  stepAtTime,
  stepStartTimes,
} from "./animation";
import type { BoardClip } from "./clipboard";
import {
  clampToBoard,
  roundPoint,
  simplifyPath,
  snapToAngle,
} from "./geometry";
import { mirrorAxes, mirrorScene, type MirrorAxis } from "./mirror";
import {
  BOARD_BOUNDS,
  viewBounds,
  type PitchPoint,
  type PitchView,
} from "./pitch";
import {
  CONTROL_MARGIN,
  isZone,
  MAX_LINES,
  MAX_POLYGON_POINTS,
  MAX_SHAPES,
  MAX_STEP_HOLD,
  MAX_STEPS,
  MAX_TOKENS,
  MIN_POLYGON_POINTS,
  isPlayTool,
  LINE_TOOLS,
  nextId,
  normalizeCaption,
  normalizeText,
  PLAY_TOOL_STYLE,
  spawnPoint,
  ZONE_KINDS,
  type BoardLine,
  type BoardShape,
  type BoardToken,
  type BoardZone,
  type LineTool,
  type SceneStep,
  type ShapeKind,
  type ZoneFill,
  type ZoneKind,
  type StepMove,
  type TacticsScene,
  type Team,
} from "./scene";
import { boardSizes } from "./token-size";

import { curveThrough } from "@/features/player/telestration/geometry";
import type {
  LineStyle,
  PenColor,
  StrokeWidth,
} from "@/features/player/telestration/state";

/**
 * What a pointer on the board does: move what is there, draw a kind of line
 * or zone, or put a text down.
 */
export type BoardMode = "move" | LineTool | ShapeKind;

export function isLineMode(mode: BoardMode): mode is LineTool {
  return LINE_TOOLS.some((tool) => tool === mode);
}

export function isZoneMode(mode: BoardMode): mode is ZoneKind {
  return ZONE_KINDS.some((kind) => kind === mode);
}

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
  /**
   * The selected tokens and lines, by id, in the order they were picked. An
   * edit to one of them (a drag, a nudge, removing it) acts on them all.
   */
  readonly selectedIds: readonly string[];
  readonly mode: BoardMode;
  readonly color: PenColor;
  readonly width: StrokeWidth;
  readonly lineStyle: LineStyle;
  /** How a new zone is painted. */
  readonly fill: ZoneFill;
  /** The line under the pointer, holding every sampled point until released. */
  readonly draft: BoardLine | null;
  /** The zone under the pointer, holding every sampled point until released. */
  readonly zoneDraft: BoardZone | null;
  /** Earlier scenes, oldest first; undo restores the last. */
  readonly past: readonly TacticsScene[];
  /** Undone scenes, the most recently undone last; redo restores it. A new edit drops them. */
  readonly future: readonly TacticsScene[];
  /** The token just pressed, until its first move makes the drag an undo step. */
  readonly grabbed: string | null;
}

export type BoardAction =
  | { readonly type: "load"; readonly scene: TacticsScene }
  | { readonly type: "select"; readonly id: string | null }
  | { readonly type: "focus"; readonly id: string }
  | { readonly type: "toggleSelect"; readonly id: string }
  | { readonly type: "selectMany"; readonly ids: readonly string[] }
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
  | {
      readonly type: "setPosition";
      readonly id: string;
      readonly position: string;
    }
  | { readonly type: "setMode"; readonly mode: BoardMode }
  | { readonly type: "setColor"; readonly color: PenColor }
  | { readonly type: "setWidth"; readonly width: StrokeWidth }
  | { readonly type: "toggleLineStyle" }
  | { readonly type: "lineBegin"; readonly at: PitchPoint }
  | {
      readonly type: "lineExtend";
      readonly at: PitchPoint;
      /** Held with Shift: straight, at a multiple of 45 degrees (not a curve). */
      readonly constrain?: boolean;
    }
  | { readonly type: "lineEnd" }
  | { readonly type: "lineCancel" }
  | { readonly type: "toggleFill" }
  | { readonly type: "zoneBegin"; readonly at: PitchPoint }
  | { readonly type: "zoneExtend"; readonly at: PitchPoint }
  | { readonly type: "zoneEnd" }
  | { readonly type: "zoneCancel" }
  | {
      readonly type: "addText";
      readonly at: PitchPoint;
      /** What the new text says until the coach types their own. */
      readonly text: string;
    }
  | { readonly type: "setText"; readonly id: string; readonly text: string }
  | {
      readonly type: "setBubble";
      readonly id: string;
      readonly bubble: boolean;
    }
  | { readonly type: "clearLines" }
  | { readonly type: "mirror"; readonly axis: MirrorAxis }
  | { readonly type: "paste"; readonly clip: BoardClip }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "goToStep"; readonly step: number }
  | { readonly type: "addStep" }
  | { readonly type: "removeStep" }
  | { readonly type: "setDuration"; readonly duration: number }
  | { readonly type: "setHold"; readonly hold: number }
  | { readonly type: "setCaption"; readonly caption: string }
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
  "toggleFill",
]);

/** How many steps undo reaches back, and redo forward. */
export const MAX_HISTORY = 50;

/**
 * The shortest line kept, in metres: a shorter drag is a click, and would
 * leave a stray arrowhead on the board.
 */
export const MIN_LINE_LENGTH = 0.5;

/**
 * The smallest zone kept, across and along, in metres: a smaller drag is a
 * click, and would leave a speck on the board.
 */
export const MIN_ZONE_SIZE = 0.5;

export function initialBoardState(scene: TacticsScene): BoardState {
  return {
    scene,
    step: 0,
    playback: null,
    speed: 1,
    selectedIds: [],
    mode: "move",
    color: "white",
    width: "medium",
    lineStyle: "solid",
    fill: "fill",
    draft: null,
    zoneDraft: null,
    past: [],
    future: [],
    grabbed: null,
  };
}

/** Replace the scene, remembering the old one for undo; a new edit has nothing to redo. */
function commit(state: BoardState, scene: TacticsScene): BoardState {
  return {
    ...state,
    scene,
    past: [...state.past, state.scene].slice(-MAX_HISTORY),
    future: [],
  };
}

/** Bring back a scene from the history, resting on a step it has. */
function restore(
  state: BoardState,
  scene: TacticsScene,
  history: Pick<BoardState, "past" | "future">,
): BoardState {
  return {
    ...state,
    ...history,
    scene,
    step: Math.min(state.step, scene.steps.length),
    selectedIds: [],
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

/** A point as the board stores it: on the part of the pitch on show, to the centimetre. */
function placed(at: PitchPoint, view: PitchView): PitchPoint {
  return roundPoint(clampToBoard(at, viewBounds(view)));
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
  const at = placed(to, scene.view);
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

/**
 * The ids an edit of one item acts on: the whole selection when the item is
 * part of it, otherwise the item alone.
 */
export function groupOf(state: BoardState, id: string): readonly string[] {
  return state.selectedIds.includes(id) ? state.selectedIds : [id];
}

/**
 * The point a drag holds an item by: a token where it stands on the step on
 * show, a line by its start, a zone by its first corner and a text by its
 * point.
 */
export function anchorOf(
  state: BoardState,
  id: string,
): PitchPoint | undefined {
  const shape = state.scene.shapes.find((candidate) => candidate.id === id);
  return (
    keyframePositions(state.scene, state.step).get(id) ??
    state.scene.lines.find((line) => line.id === id)?.points[0] ??
    (shape && shapePoints(shape)[0])
  );
}

/** Every point a shape keeps: a zone's corners, or a text's point. */
function shapePoints(shape: BoardShape): readonly PitchPoint[] {
  return isZone(shape) ? shape.points : [shape];
}

/** A shape moved by an amount. */
function shiftShape(shape: BoardShape, dx: number, dy: number): BoardShape {
  const shift = (point: PitchPoint) =>
    roundPoint({ x: point.x + dx, y: point.y + dy });
  return isZone(shape)
    ? { ...shape, points: shape.points.map(shift) }
    : { ...shape, ...shift(shape) };
}

/** Whether a point of a line is a curve's control point, which may lie off the board. */
function isControlPoint(line: BoardLine, index: number): boolean {
  return line.points.length === 3 && index === 1;
}

/**
 * How far a shift may go along one axis so none of the values leaves
 * `[min, max]`. A value already outside is not pulled back in.
 */
function clampShift(
  shift: number,
  values: readonly number[],
  min: number,
  max: number,
): number {
  const low = Math.min(0, min - Math.min(...values));
  const high = Math.max(0, max - Math.max(...values));
  return Math.min(Math.max(shift, low), high);
}

/**
 * Move tokens, lines and shapes together by the same amount on a step: the
 * tokens' start positions on step 0, where the step runs them to on a later
 * one, and the lines, zones and texts as they are drawn. At the edge of the
 * part of the pitch on show the whole group stops, so it keeps its shape.
 */
function translateItems(
  scene: TacticsScene,
  step: number,
  ids: readonly string[],
  by: PitchPoint,
): TacticsScene {
  const positions = keyframePositions(scene, step);
  const tokens = ids.flatMap((id) => {
    const at = positions.get(id);
    return at ? [{ id, at }] : [];
  });
  const lines = scene.lines.filter((line) => ids.includes(line.id));
  const shapes = scene.shapes.filter((shape) => ids.includes(shape.id));
  const ends = [
    ...tokens.map((token) => token.at),
    ...lines.flatMap((line) =>
      line.points.filter((_, index) => !isControlPoint(line, index)),
    ),
    ...shapes.flatMap(shapePoints),
  ];
  if (ends.length === 0) return scene;
  const bounds = viewBounds(scene.view);
  const dx = clampShift(
    by.x,
    ends.map((point) => point.x),
    bounds.minX,
    bounds.maxX,
  );
  const dy = clampShift(
    by.y,
    ends.map((point) => point.y),
    bounds.minY,
    bounds.maxY,
  );
  const moved = tokens.reduce(
    (next, { id, at }) =>
      placeOnStep(next, step, id, { x: at.x + dx, y: at.y + dy }),
    scene,
  );
  const controlBounds = {
    minX: BOARD_BOUNDS.minX - CONTROL_MARGIN,
    minY: BOARD_BOUNDS.minY - CONTROL_MARGIN,
    maxX: BOARD_BOUNDS.maxX + CONTROL_MARGIN,
    maxY: BOARD_BOUNDS.maxY + CONTROL_MARGIN,
  };
  return {
    ...moved,
    lines: moved.lines.map((line) =>
      ids.includes(line.id)
        ? {
            ...line,
            points: line.points.map((point, index) => {
              const shifted = roundPoint({ x: point.x + dx, y: point.y + dy });
              return isControlPoint(line, index)
                ? clampToBoard(shifted, controlBounds)
                : shifted;
            }),
          }
        : line,
    ),
    shapes: moved.shapes.map((shape) =>
      ids.includes(shape.id) ? shiftShape(shape, dx, dy) : shape,
    ),
  };
}

/**
 * How far a paste moves along, across and down in pitch terms, when what it
 * brings would land right on what already stands there, as when pasting into
 * the scene it was copied from: a player token's width on the view, so the
 * copy shows beside the original rather than under it.
 */
function pasteOffset(view: PitchView): number {
  return boardSizes(view).player * 2;
}

/**
 * The tokens, lines and shapes of a clip placed in the scene, or `null` when
 * they do not fit.
 */
function pasteItems(
  state: BoardState,
  clip: BoardClip,
): { scene: TacticsScene; ids: string[] } | null {
  const { scene, step } = state;
  if (clip.view !== scene.view) return null;
  // A scene holds one ball: a copied ball joins only a scene without one.
  const hasBall = scene.tokens.some((token) => token.kind === "ball");
  const tokens = clip.tokens.filter(
    (token) => !(hasBall && token.kind === "ball"),
  );
  if (tokens.length + clip.lines.length + clip.shapes.length === 0) return null;
  if (scene.tokens.length + tokens.length > MAX_TOKENS) return null;
  if (scene.lines.length + clip.lines.length > MAX_LINES) return null;
  if (scene.shapes.length + clip.shapes.length > MAX_SHAPES) return null;

  const standing = [
    ...keyframePositions(scene, step).values(),
    ...scene.lines.flatMap((line) => line.points.slice(0, 1)),
    ...scene.shapes.flatMap((shape) => shapePoints(shape).slice(0, 1)),
  ];
  const starts = [
    ...tokens,
    ...clip.lines.flatMap((line) => line.points.slice(0, 1)),
    ...clip.shapes.flatMap((shape) => shapePoints(shape).slice(0, 1)),
  ];
  const taken = (by: number) =>
    starts.some((start) =>
      standing.some(
        (point) =>
          Math.abs(point.x - start.x - by) < 0.01 &&
          Math.abs(point.y - start.y - by) < 0.01,
      ),
    );
  const offset = pasteOffset(scene.view);
  let by = 0;
  while (taken(by) && by < 20 * offset) by += offset;

  let next = scene;
  const ids: string[] = [];
  for (const token of tokens) {
    const id = nextId(next, token.kind === "ball" ? "b" : "p");
    ids.push(id);
    next = { ...next, tokens: [...next.tokens, { ...token, id }] };
  }
  for (const line of clip.lines) {
    const id = nextId(next, "l");
    ids.push(id);
    next = { ...next, lines: [...next.lines, { ...line, id, step }] };
  }
  for (const shape of clip.shapes) {
    const id = nextId(next, isZone(shape) ? "z" : "t");
    ids.push(id);
    next = { ...next, shapes: [...next.shapes, { ...shape, id, step }] };
  }
  // Moved along as a group, which stops it at the edge in one piece; the new
  // tokens stand there from the start, so on a later step too.
  return { scene: translateItems(next, 0, ids, { x: by, y: by }), ids };
}

/**
 * The scene without these tokens, lines and shapes; a removed token leaves
 * every step it ran in.
 */
function removeItems(
  scene: TacticsScene,
  ids: readonly string[],
): TacticsScene {
  return {
    ...scene,
    tokens: scene.tokens.filter((token) => !ids.includes(token.id)),
    lines: scene.lines.filter((line) => !ids.includes(line.id)),
    shapes: scene.shapes.filter((shape) => !ids.includes(shape.id)),
    steps: scene.steps.map((step) => ({
      ...step,
      moves: step.moves.filter((move) => !ids.includes(move.token)),
    })),
  };
}

/** Rest on a step, dropping selected lines and shapes the step does not show. */
function restOn(state: BoardState, step: number): BoardState {
  const clamped = Math.min(Math.max(step, 0), state.scene.steps.length);
  const shown = [
    ...state.scene.tokens,
    ...linesForStep(state.scene, clamped),
    ...shapesForStep(state.scene, clamped),
  ];
  const kept = state.selectedIds.filter((id) =>
    shown.some((item) => item.id === id),
  );
  return {
    ...state,
    step: clamped,
    playback: null,
    draft: null,
    zoneDraft: null,
    selectedIds:
      kept.length === state.selectedIds.length ? state.selectedIds : kept,
  };
}

/**
 * Show a moment of the animation; a paused moment where the board stands
 * still (the start, a keyframe or a step's hold) rests on its step.
 */
function showTime(
  state: BoardState,
  time: number,
  playing: boolean,
): BoardState {
  const { scene } = state;
  const clamped = Math.min(Math.max(time, 0), sceneDuration(scene));
  if (!playing && (clamped === 0 || isHolding(scene, clamped)))
    return restOn(state, stepAtTime(scene, clamped));
  return { ...state, playback: { time: clamped, playing } };
}

/** Advance or rewind a step from what is on show now. */
function stepBy(state: BoardState, direction: 1 | -1): BoardState {
  const { playback, scene } = state;
  if (!playback) return restOn(state, state.step + direction);
  // Partway through step k: back rests on where it started, forward on
  // where it arrives. Holding on step k is resting on it.
  const step = stepAtTime(scene, playback.time);
  if (isHolding(scene, playback.time)) return restOn(state, step + direction);
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

/**
 * How far a play line's drag may stray from the straight line between its
 * ends, as a share of that line's length, and still be kept straight: a hand
 * never drags quite straight, and a pass drawn with a wobble is still meant
 * straight.
 */
const STRAIGHT_TOLERANCE = 0.08;

/** Whether every sampled point lies close enough to the chord for a straight line. */
function isNearlyStraight(points: readonly PitchPoint[]): boolean {
  const start = points[0];
  const end = points[points.length - 1];
  if (!start || !end) return true;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chord = Math.hypot(dx, dy);
  if (chord === 0) return true;
  return points.every(
    (point) =>
      Math.abs((point.x - start.x) * dy - (point.y - start.y) * dx) / chord <=
      chord * STRAIGHT_TOLERANCE,
  );
}

/**
 * A draft in the shape it is stored in: two ends, or a curve's start, control
 * and end. A curve always bends through the drag; a play line bends only when
 * the drag clearly did. The board draws the draft in this shape too, so what
 * shows while dragging is what the release keeps.
 */
export function shapeLine(draft: BoardLine): BoardLine | null {
  const start = draft.points[0];
  const end = draft.points[draft.points.length - 1];
  if (!start || !end) return null;
  const bends =
    draft.tool === "curve" ||
    (isPlayTool(draft.tool) && !isNearlyStraight(draft.points));
  if (!bends) return { ...draft, points: [start, end] };
  const curve = curveThrough(draft.points);
  if (!curve) return null;
  return {
    ...draft,
    points: [curve.start, roundPoint(curve.control), curve.end],
  };
}

/**
 * How close to its outline a polygon's corners lie to the hand-drawn path, as
 * a share of the path's size: close enough to keep its shape, loose enough to
 * drop a hand's wobble.
 */
const POLYGON_TOLERANCE = 0.02;

function extent(points: readonly PitchPoint[]): { x: number; y: number } {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.max(...xs) - Math.min(...xs),
    y: Math.max(...ys) - Math.min(...ys),
  };
}

/**
 * A zone draft in the shape it is stored in, or `null` while it is too small
 * to keep. A box or an oval keeps its two corners. A polygon keeps the corners
 * of the hand-drawn path, as few as keep its shape and at most
 * {@link MAX_POLYGON_POINTS}; it closes itself, so an end drawn back onto the
 * start is dropped. The board draws the draft in this shape too, so what
 * shows while dragging is what the release keeps.
 */
export function shapeZone(draft: BoardZone): BoardZone | null {
  const size = extent(draft.points);
  if (size.x < MIN_ZONE_SIZE || size.y < MIN_ZONE_SIZE) return null;
  if (draft.kind !== "polygon") return draft;
  const tolerance = Math.max(
    Math.hypot(size.x, size.y) * POLYGON_TOLERANCE,
    0.1,
  );
  const found = simplifyPath(draft.points, tolerance);
  // A path with more corners than a polygon keeps (a scribble) keeps some
  // evenly spread along it.
  let corners =
    found.length <= MAX_POLYGON_POINTS
      ? found
      : Array.from(
          { length: MAX_POLYGON_POINTS },
          (_, index) =>
            found[
              Math.round(
                (index * (found.length - 1)) / (MAX_POLYGON_POINTS - 1),
              )
            ] as PitchPoint,
        );
  const first = corners[0];
  const last = corners[corners.length - 1];
  if (
    first &&
    last &&
    corners.length > MIN_POLYGON_POINTS &&
    Math.hypot(last.x - first.x, last.y - first.y) <= tolerance * 2
  )
    corners = corners.slice(0, -1);
  return corners.length >= MIN_POLYGON_POINTS
    ? { ...draft, points: corners }
    : null;
}

function mapShape(
  scene: TacticsScene,
  id: string,
  update: (shape: BoardShape) => BoardShape,
): TacticsScene {
  return {
    ...scene,
    shapes: scene.shapes.map((shape) =>
      shape.id === id ? update(shape) : shape,
    ),
  };
}

/**
 * Lines or shapes once a step is put in after step `at` (`1`: later ones move
 * one along) or step `at` is taken out (`-1`: its own go with it, later ones
 * move one back).
 */
function restep<T extends { readonly step: number }>(
  items: readonly T[],
  at: number,
  by: 1 | -1,
): T[] {
  return items
    .filter((item) => by === 1 || item.step !== at)
    .map((item) => (item.step > at ? { ...item, step: item.step + by } : item));
}

/** A released draft as stored, or `null` when it was only a click. */
function finishLine(draft: BoardLine): BoardLine | null {
  return isKeptLine(draft) ? shapeLine(draft) : null;
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
    case "load":
      // A new start: nothing to undo back into, the pen and speed kept.
      return {
        ...initialBoardState(action.scene),
        mode: state.mode,
        color: state.color,
        width: state.width,
        lineStyle: state.lineStyle,
        fill: state.fill,
        speed: state.speed,
      };
    case "select":
      return { ...state, selectedIds: action.id === null ? [] : [action.id] };
    case "focus":
      // Tabbing onto a selected item keeps the selection it belongs to.
      return state.selectedIds.includes(action.id)
        ? state
        : { ...state, selectedIds: [action.id] };
    case "toggleSelect":
      return {
        ...state,
        selectedIds: state.selectedIds.includes(action.id)
          ? state.selectedIds.filter((id) => id !== action.id)
          : [...state.selectedIds, action.id],
      };
    case "selectMany":
      return {
        ...state,
        selectedIds: [
          ...state.selectedIds,
          ...action.ids.filter((id) => !state.selectedIds.includes(id)),
        ],
      };
    case "grab":
      // Pressing a selected item keeps the selection, so a drag moves it all.
      return {
        ...state,
        selectedIds: groupOf(state, action.id),
        grabbed: action.id,
      };
    case "drag": {
      const at = anchorOf(state, action.id);
      if (!at) return state;
      const moved = translateItems(
        scene,
        state.step,
        groupOf(state, action.id),
        {
          x: action.to.x - at.x,
          y: action.to.y - at.y,
        },
      );
      // A whole drag is one undo step: its first move remembers the scene as
      // it was before, so pressing a token without moving it adds no step.
      return state.grabbed === action.id
        ? { ...commit(state, moved), grabbed: null }
        : { ...state, scene: moved };
    }
    case "nudge":
      if (!anchorOf(state, action.id)) return state;
      return commit(
        state,
        translateItems(scene, state.step, groupOf(state, action.id), action.by),
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
        position: "",
        playerId: null,
        ...spawnPoint(action.team, scene.view),
      };
      return {
        ...commit(state, { ...scene, tokens: [...scene.tokens, token] }),
        selectedIds: [id],
      };
    }
    case "addBall": {
      const hasBall = scene.tokens.some((token) => token.kind === "ball");
      if (hasBall || scene.tokens.length >= MAX_TOKENS) return state;
      const id = nextId(scene, "b");
      const ball: BoardToken = {
        id,
        kind: "ball",
        ...spawnPoint("ball", scene.view),
      };
      return {
        ...commit(state, { ...scene, tokens: [...scene.tokens, ball] }),
        selectedIds: [id],
      };
    }
    case "remove": {
      const removed = removeItems(scene, groupOf(state, action.id));
      if (
        removed.tokens.length === scene.tokens.length &&
        removed.lines.length === scene.lines.length &&
        removed.shapes.length === scene.shapes.length
      )
        return state;
      return { ...commit(state, removed), selectedIds: [] };
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
    case "setPosition":
      return commit(
        state,
        mapToken(scene, action.id, (token) =>
          token.kind === "player"
            ? { ...token, position: action.position }
            : token,
        ),
      );
    case "setMode":
      return { ...state, mode: action.mode, draft: null, zoneDraft: null };
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
      if (!isLineMode(state.mode) || scene.lines.length >= MAX_LINES)
        return state;
      return {
        ...state,
        selectedIds: [],
        draft: {
          id: nextId(scene, "l"),
          tool: state.mode,
          color: state.color,
          width: state.width,
          // A play tool's look is its meaning, so it keeps its own style.
          style: isPlayTool(state.mode)
            ? PLAY_TOOL_STYLE[state.mode]
            : state.lineStyle,
          points: [roundPoint(action.at)],
          step: state.step,
        },
      };
    case "lineExtend": {
      const { draft } = state;
      if (!draft) return state;
      const at = roundPoint(action.at);
      const start = draft.points[0] ?? at;
      if (action.constrain && draft.tool !== "curve") {
        const end = snapToAngle(start, at, viewBounds(scene.view));
        return {
          ...state,
          draft: { ...draft, points: [start, roundPoint(end)] },
        };
      }
      // A straight line only needs its two ends; a curve or a play line keeps
      // the whole drag so it can bend through the point farthest from the
      // straight line.
      const points =
        draft.tool === "curve" || isPlayTool(draft.tool)
          ? [...draft.points, at]
          : [start, at];
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
    case "toggleFill":
      return { ...state, fill: state.fill === "fill" ? "hatch" : "fill" };
    case "zoneBegin":
      if (!isZoneMode(state.mode) || scene.shapes.length >= MAX_SHAPES)
        return state;
      return {
        ...state,
        selectedIds: [],
        zoneDraft: {
          id: nextId(scene, "z"),
          kind: state.mode,
          color: state.color,
          fill: state.fill,
          points: [placed(action.at, scene.view)],
          step: state.step,
        },
      };
    case "zoneExtend": {
      const { zoneDraft } = state;
      if (!zoneDraft) return state;
      const at = placed(action.at, scene.view);
      // A box or oval only needs its two corners; a polygon keeps the whole
      // drag to find its corners in.
      const points =
        zoneDraft.kind === "polygon"
          ? [...zoneDraft.points, at]
          : [zoneDraft.points[0] ?? at, at];
      return { ...state, zoneDraft: { ...zoneDraft, points } };
    }
    case "zoneEnd": {
      const { zoneDraft } = state;
      if (!zoneDraft) return state;
      const zone = shapeZone(zoneDraft);
      const next = { ...state, zoneDraft: null };
      return zone
        ? commit(next, { ...scene, shapes: [...scene.shapes, zone] })
        : next;
    }
    case "zoneCancel":
      return state.zoneDraft ? { ...state, zoneDraft: null } : state;
    case "addText": {
      const text = normalizeText(action.text);
      if (state.mode !== "text" || text === null) return state;
      if (scene.shapes.length >= MAX_SHAPES) return state;
      const id = nextId(scene, "t");
      const shape: BoardShape = {
        id,
        kind: "text",
        color: state.color,
        text,
        bubble: false,
        ...placed(action.at, scene.view),
        step: state.step,
      };
      // Put down, the text is edited and moved like everything else.
      return {
        ...commit(state, { ...scene, shapes: [...scene.shapes, shape] }),
        mode: "move",
        selectedIds: [id],
      };
    }
    case "setText": {
      const text = normalizeText(action.text);
      if (text === null) return state;
      return commit(
        state,
        mapShape(scene, action.id, (shape) =>
          shape.kind === "text" ? { ...shape, text } : shape,
        ),
      );
    }
    case "setBubble":
      return commit(
        state,
        mapShape(scene, action.id, (shape) =>
          shape.kind === "text" ? { ...shape, bubble: action.bubble } : shape,
        ),
      );
    case "clearLines": {
      // Only what the step drew itself: step 0's lines and shapes show on
      // every step.
      const lines = scene.lines.filter((line) => line.step !== state.step);
      const shapes = scene.shapes.filter((shape) => shape.step !== state.step);
      if (
        lines.length === scene.lines.length &&
        shapes.length === scene.shapes.length
      )
        return state;
      return commit(state, { ...scene, lines, shapes });
    }
    case "mirror":
      if (!mirrorAxes(scene.view).includes(action.axis)) return state;
      return commit(state, mirrorScene(scene, action.axis));
    case "paste": {
      const pasted = pasteItems(state, action.clip);
      if (!pasted) return state;
      return { ...commit(state, pasted.scene), selectedIds: pasted.ids };
    }
    case "undo": {
      if (state.draft) return { ...state, draft: null };
      if (state.zoneDraft) return { ...state, zoneDraft: null };
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return restore(state, previous, {
        past: state.past.slice(0, -1),
        future: [...state.future, scene].slice(-MAX_HISTORY),
      });
    }
    case "redo": {
      if (state.draft) return { ...state, draft: null };
      if (state.zoneDraft) return { ...state, zoneDraft: null };
      const next = state.future[state.future.length - 1];
      if (!next) return state;
      return restore(state, next, {
        past: [...state.past, scene].slice(-MAX_HISTORY),
        future: state.future.slice(0, -1),
      });
    }
    case "goToStep":
      return restOn(state, action.step);
    case "addStep": {
      if (scene.steps.length >= MAX_STEPS) return state;
      // The new step comes right after the one on show; later steps and
      // their lines and shapes move one along.
      const at = state.step;
      const steps = [
        ...scene.steps.slice(0, at),
        { duration: DEFAULT_STEP_DURATION, hold: 0, caption: "", moves: [] },
        ...scene.steps.slice(at),
      ];
      const lines = restep(scene.lines, at, 1);
      const shapes = restep(scene.shapes, at, 1);
      return restOn(commit(state, { ...scene, steps, lines, shapes }), at + 1);
    }
    case "removeStep": {
      const at = state.step;
      if (at === 0) return state;
      const steps = scene.steps.filter((_, index) => index !== at - 1);
      const lines = restep(scene.lines, at, -1);
      const shapes = restep(scene.shapes, at, -1);
      return restOn(commit(state, { ...scene, steps, lines, shapes }), at - 1);
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
    case "setHold":
      if (state.step === 0) return state;
      if (!(action.hold >= 0 && action.hold <= MAX_STEP_HOLD)) return state;
      return commit(
        state,
        mapStep(scene, state.step, (current) => ({
          ...current,
          hold: action.hold,
        })),
      );
    case "setCaption": {
      // The step on show gets the caption; step 0 is the start arrangement's.
      const caption = normalizeCaption(action.caption);
      if (caption === null) return state;
      if (caption === captionForStep(scene, state.step)) return state;
      if (state.step === 0)
        return commit(state, { ...scene, startCaption: caption });
      return commit(
        state,
        mapStep(scene, state.step, (current) => ({ ...current, caption })),
      );
    }
    case "bend": {
      if (!moveIn(scene, state.step, action.id)) return state;
      const bent = mapStep(scene, state.step, (current) => ({
        ...current,
        moves: current.moves.map((move) =>
          move.token === action.id
            ? { ...move, via: placed(action.via, scene.view) }
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
      // Carry on from a paused moment, or with the step after the one on
      // show (its hold is already on screen); at the end it starts over.
      const from =
        state.playback?.time ?? stepStartTimes(scene)[state.step] ?? total;
      return {
        ...state,
        selectedIds: [],
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
        selectedIds: [],
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
