/**
 * The tactics scene document (ADR 0010): what stands on the board, what is
 * drawn on it, how it moves step by step (ADR 0012) and how much of the pitch
 * it shows, stored as one versioned JSON value. Positions are pitch metres
 * (see `pitch.ts`), never pixels, so a scene looks the same on every screen.
 *
 * Every stored or submitted scene passes {@link parseScene} first. It checks
 * the shape, drops nothing silently and rejects the whole document on the first
 * bad value, so the database only ever holds scenes this module can draw.
 * Older versions are upgraded here on the way in (version 1 had no steps,
 * version 2 no view, version 3 a short corner at either goal, version 4 no
 * play lines); nothing else reads the raw JSON.
 */
import { roundPoint } from "./geometry";
import {
  BOARD_BOUNDS,
  CENTRE,
  PITCH_LENGTH,
  PITCH_VIEWS,
  PITCH_WIDTH,
  viewBounds,
  type PitchPoint,
  type PitchView,
} from "./pitch";

import {
  PEN_COLORS,
  STROKE_WIDTHS,
  type LineStyle,
  type PenColor,
  type StrokeWidth,
} from "@/features/player/telestration/state";

/** The scene format this code writes. */
export const SCENE_VERSION = 5;

/** The two sides on the board. `home` is the coach's team. */
export type Team = "home" | "away";
export const TEAMS: readonly Team[] = ["home", "away"];

/** A player token: a team, a short label and optionally a roster player. */
export interface PlayerToken {
  readonly id: string;
  readonly kind: "player";
  readonly team: Team;
  /** A shirt number or a short free label (`TW`, `LV`). */
  readonly label: string;
  /** The roster player this token stands for, or `null` for a free label. */
  readonly playerId: string | null;
  readonly x: number;
  readonly y: number;
}

/** The ball. A scene has at most one. */
export interface BallToken {
  readonly id: string;
  readonly kind: "ball";
  readonly x: number;
  readonly y: number;
}

export type BoardToken = PlayerToken | BallToken;

/**
 * What a board line is. The drawing tools are a plain line, a straight arrow
 * and a curved arrow (the telestration Schlenzer arrow), in any pen style. The
 * play tools say what happens on the pitch, each in its own fixed look named
 * in the board's legend: a run (dotted arrow), a pass (solid arrow), a
 * dribble (wavy arrow) and a block (a line ending in a bar across it).
 */
export type LineTool = DrawingTool | PlayTool;
export type DrawingTool = "line" | "arrow" | "curve";
export type PlayTool = "run" | "pass" | "dribble" | "block";
export const PLAY_TOOLS: readonly PlayTool[] = [
  "run",
  "pass",
  "dribble",
  "block",
];
export const LINE_TOOLS: readonly LineTool[] = [
  "line",
  "arrow",
  "curve",
  ...PLAY_TOOLS,
];

/** The pen style a play tool always draws with: a run dotted, the rest solid. */
export const PLAY_TOOL_STYLE: Readonly<Record<PlayTool, LineStyle>> = {
  run: "dotted",
  pass: "solid",
  dribble: "solid",
  block: "solid",
};

export function isPlayTool(tool: LineTool): tool is PlayTool {
  return isOneOf(PLAY_TOOLS, tool);
}

/**
 * A line on the board, in the telestration look. A line or arrow keeps its two
 * ends; a curve keeps `[start, control, end]` of a quadratic Bezier, whose
 * control point may lie off the board for a strong bend. A play line is either:
 * straight with two ends, or bent with three points like a curve.
 */
export interface BoardLine {
  readonly id: string;
  readonly tool: LineTool;
  readonly color: PenColor;
  readonly width: StrokeWidth;
  /** Free for a drawing tool; always the tool's {@link PLAY_TOOL_STYLE} for a play tool. */
  readonly style: LineStyle;
  readonly points: readonly PitchPoint[];
  /**
   * The step the line belongs to: `0` shows it throughout, `k` only while
   * step `k` plays and while the board rests on it (ADR 0012).
   */
  readonly step: number;
}

/**
 * Where a token runs to in a step. The run is straight, or bends through
 * `via`: the point the path passes halfway, which the coach drags.
 */
export interface StepMove {
  readonly token: string;
  readonly x: number;
  readonly y: number;
  readonly via: PitchPoint | null;
}

/**
 * One step of the animation: the tokens that move, and how many seconds the
 * move takes. A token not listed stays where the step before left it.
 */
export interface SceneStep {
  readonly duration: number;
  readonly moves: readonly StepMove[];
}

export interface TacticsScene {
  readonly version: typeof SCENE_VERSION;
  /**
   * How much of the pitch the scene shows: the whole board or the short-corner
   * quarter. Chosen when the scene is created and fixed from then on. Only a
   * view: positions stay pitch metres, and what lies outside the quarter is
   * hidden, not lost.
   */
  readonly view: PitchView;
  /** Tokens bottom to top at their start positions (step 0). */
  readonly tokens: readonly BoardToken[];
  /** Lines oldest first; they lie under the tokens. */
  readonly lines: readonly BoardLine[];
  /** Steps 1 to n after the start arrangement, in playing order. */
  readonly steps: readonly SceneStep[];
}

/** Limits that keep a scene a board, not a data dump. */
export const MAX_TOKENS = 40;
export const MAX_LINES = 60;
export const MAX_LABEL_LENGTH = 4;
export const MAX_STEPS = 20;
/** The range of a step's move time, in seconds. */
export const MIN_STEP_DURATION = 0.5;
export const MAX_STEP_DURATION = 10;
/** Max length of the submitted JSON text, checked before parsing it. */
export const MAX_SCENE_JSON_LENGTH = 100_000;
/** How far off the board a curve's control point may lie, in metres. */
const CONTROL_MARGIN = 100;

const ID_RE = /^[a-z0-9]{1,12}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return values.some((candidate) => candidate === value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Read a point on the board, or `null`; `margin` widens the board for control points. */
function parsePoint(value: unknown, margin = 0): PitchPoint | null {
  if (!isObject(value) || !finite(value.x) || !finite(value.y)) return null;
  const { minX, minY, maxX, maxY } = BOARD_BOUNDS;
  if (value.x < minX - margin || value.x > maxX + margin) return null;
  if (value.y < minY - margin || value.y > maxY + margin) return null;
  return roundPoint({ x: value.x, y: value.y });
}

/** Normalize a token label: trimmed, at most {@link MAX_LABEL_LENGTH} characters. */
export function normalizeLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return [...trimmed].length <= MAX_LABEL_LENGTH ? trimmed : null;
}

function parseToken(value: unknown): BoardToken | null {
  if (!isObject(value) || typeof value.id !== "string") return null;
  if (!ID_RE.test(value.id)) return null;
  const at = parsePoint(value);
  if (!at) return null;
  if (value.kind === "ball") return { id: value.id, kind: "ball", ...at };
  if (value.kind !== "player" || !isOneOf(TEAMS, value.team)) return null;
  const label = normalizeLabel(value.label);
  if (label === null) return null;
  const { playerId } = value;
  if (
    playerId !== null &&
    !(typeof playerId === "string" && UUID_RE.test(playerId))
  )
    return null;
  return {
    id: value.id,
    kind: "player",
    team: value.team,
    label,
    playerId: playerId === null ? null : playerId.toLowerCase(),
    ...at,
  };
}

/** How many points a line of a tool keeps: two ends, or a curve's three. */
function pointCounts(tool: LineTool): readonly number[] {
  if (tool === "curve") return [3];
  return isPlayTool(tool) ? [2, 3] : [2];
}

function parseLine(value: unknown, stepCount: number): BoardLine | null {
  if (!isObject(value) || typeof value.id !== "string") return null;
  if (!ID_RE.test(value.id)) return null;
  const { tool, color, width, style, points, step } = value;
  if (!Number.isInteger(step) || (step as number) < 0) return null;
  if ((step as number) > stepCount) return null;
  if (!isOneOf(LINE_TOOLS, tool) || !isOneOf(PEN_COLORS, color)) return null;
  if (!isOneOf(STROKE_WIDTHS, width)) return null;
  if (style !== "solid" && style !== "dotted") return null;
  if (isPlayTool(tool) && style !== PLAY_TOOL_STYLE[tool]) return null;
  if (!Array.isArray(points)) return null;
  if (!pointCounts(tool).includes(points.length)) return null;
  const parsed = points.map((point, index) =>
    parsePoint(point, points.length === 3 && index === 1 ? CONTROL_MARGIN : 0),
  );
  if (parsed.some((point) => point === null)) return null;
  return {
    id: value.id,
    tool,
    color,
    width,
    style,
    points: parsed as PitchPoint[],
    step: step as number,
  };
}

function parseMove(
  value: unknown,
  tokenIds: ReadonlySet<string>,
): StepMove | null {
  if (!isObject(value) || typeof value.token !== "string") return null;
  if (!tokenIds.has(value.token)) return null;
  const at = parsePoint(value);
  if (!at) return null;
  const via = value.via === null ? null : parsePoint(value.via);
  if (via === null && value.via !== null) return null;
  return { token: value.token, ...at, via };
}

function parseStep(
  value: unknown,
  tokenIds: ReadonlySet<string>,
): SceneStep | null {
  if (!isObject(value) || !finite(value.duration)) return null;
  const duration = Math.round(value.duration * 100) / 100;
  if (duration < MIN_STEP_DURATION || duration > MAX_STEP_DURATION) return null;
  const { moves } = value;
  if (!Array.isArray(moves) || moves.length > tokenIds.size) return null;
  const parsed = moves.map((move) => parseMove(move, tokenIds));
  if (parsed.some((move) => move === null)) return null;
  const clean = parsed as StepMove[];
  // A token runs once per step.
  if (new Set(clean.map((move) => move.token)).size !== clean.length)
    return null;
  return { duration, moves: clean };
}

/**
 * A point turned half round the centre spot, or the value as it was when it is
 * not a point (validation rejects it later). The pitch looks the same turned
 * end to end, so a scene turned this way shows the same play at the other goal.
 */
function turnedEndToEnd(value: unknown): unknown {
  if (!isObject(value) || !finite(value.x) || !finite(value.y)) return value;
  return { ...value, x: PITCH_LENGTH - value.x, y: PITCH_WIDTH - value.y };
}

function mapArray(value: unknown, map: (item: unknown) => unknown): unknown {
  return Array.isArray(value) ? value.map(map) : value;
}

/** A version 3 scene turned end to end: its tokens, lines, runs and bends. */
function sceneTurnedEndToEnd(value: Json): Json {
  return {
    ...value,
    tokens: mapArray(value.tokens, turnedEndToEnd),
    lines: mapArray(value.lines, (line) =>
      isObject(line)
        ? { ...line, points: mapArray(line.points, turnedEndToEnd) }
        : line,
    ),
    steps: mapArray(value.steps, (step) =>
      isObject(step)
        ? {
            ...step,
            moves: mapArray(step.moves, (move) => {
              const turned = turnedEndToEnd(move);
              return isObject(turned) && isObject(turned.via)
                ? { ...turned, via: turnedEndToEnd(turned.via) }
                : turned;
            }),
          }
        : step,
    ),
  };
}

/**
 * Bring an older document up to the current version one version at a time,
 * still unvalidated. Version 1 had no steps: its lines show throughout, so
 * they go to step 0. Version 2 had no view: it showed the whole pitch.
 * Version 3 showed a short corner at the left or the right goal; there is one
 * short-corner view now, at the left goal, so a right-goal scene is turned end
 * to end. On a landscape screen it looks exactly as before. Version 4 had
 * only the drawing tools, which version 5 keeps as they were next to the new
 * play tools, so its lines keep their look unchanged.
 */
function upgrade(value: Json): Json {
  if (value.version === 1) {
    const { lines } = value;
    return upgrade({
      ...value,
      version: 2,
      lines: Array.isArray(lines)
        ? lines.map((line: unknown) =>
            isObject(line) ? { ...line, step: 0 } : line,
          )
        : lines,
      steps: [],
    });
  }
  if (value.version === 2)
    return upgrade({ ...value, version: 3, view: "full" });
  if (value.version === 3) {
    if (value.view === "corner-left")
      return upgrade({ ...value, version: 4, view: "corner" });
    if (value.view === "corner-right")
      return upgrade({
        ...sceneTurnedEndToEnd(value),
        version: 4,
        view: "corner",
      });
    return upgrade({ ...value, version: 4 });
  }
  if (value.version === 4) return { ...value, version: 5 };
  return value;
}

/**
 * Validate an untrusted scene (parsed JSON), returning a clean copy or `null`.
 * An older version is upgraded first. Coordinates are rounded to the
 * centimetre and durations to the hundredth; ids must be unique across tokens
 * and lines, a scene holds at most one ball, a step only moves tokens the
 * scene has, and a line only belongs to a step the scene has.
 */
export function parseScene(raw: unknown): TacticsScene | null {
  if (!isObject(raw)) return null;
  const value = upgrade(raw);
  if (value.version !== SCENE_VERSION) return null;
  const { view, tokens, lines, steps } = value;
  if (!isOneOf(PITCH_VIEWS, view)) return null;
  if (!Array.isArray(tokens) || tokens.length > MAX_TOKENS) return null;
  if (!Array.isArray(lines) || lines.length > MAX_LINES) return null;
  if (!Array.isArray(steps) || steps.length > MAX_STEPS) return null;

  const parsedTokens = tokens.map(parseToken);
  if (parsedTokens.some((token) => token === null)) return null;
  const cleanTokens = parsedTokens as BoardToken[];
  const tokenIds = new Set(cleanTokens.map((token) => token.id));
  const parsedLines = lines.map((line) => parseLine(line, steps.length));
  const parsedSteps = steps.map((step) => parseStep(step, tokenIds));
  if (parsedLines.some((line) => line === null)) return null;
  if (parsedSteps.some((step) => step === null)) return null;
  const cleanLines = parsedLines as BoardLine[];

  const ids = [...cleanTokens, ...cleanLines].map((item) => item.id);
  if (new Set(ids).size !== ids.length) return null;
  if (cleanTokens.filter((token) => token.kind === "ball").length > 1)
    return null;
  return {
    version: SCENE_VERSION,
    view,
    tokens: cleanTokens,
    lines: cleanLines,
    steps: parsedSteps as SceneStep[],
  };
}

/**
 * Parse a scene submitted as JSON text, or `null` when it is too long, not
 * JSON, or not a valid scene.
 */
export function parseSceneJson(text: unknown): TacticsScene | null {
  if (typeof text !== "string" || text.length > MAX_SCENE_JSON_LENGTH)
    return null;
  try {
    return parseScene(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * The scene as a share link carries it (ADR 0014): everything the board draws,
 * but no token links to a roster player, which only the coach's board uses.
 */
export function withoutRosterLinks(scene: TacticsScene): TacticsScene {
  return {
    ...scene,
    tokens: scene.tokens.map((token) =>
      token.kind === "player" ? { ...token, playerId: null } : token,
    ),
  };
}

/**
 * A fresh id for a new token or line: the prefix plus one more than the
 * highest number already used with it, so ids stay short and never repeat.
 */
export function nextId(scene: TacticsScene, prefix: "p" | "b" | "l"): string {
  let highest = 0;
  for (const item of [...scene.tokens, ...scene.lines]) {
    if (!item.id.startsWith(prefix)) continue;
    const n = Number(item.id.slice(prefix.length));
    if (Number.isInteger(n) && n > highest) highest = n;
  }
  return `${prefix}${highest + 1}`;
}

/**
 * A plain 1-3-4-3 per side, the home side playing left to right: where each of
 * the eleven starts on a new board, keeper first. Only a starting point - the
 * coach drags from here.
 */
const HOME_LINEUP: readonly PitchPoint[] = [
  { x: 3, y: 27.5 },
  { x: 16, y: 14 },
  { x: 16, y: 27.5 },
  { x: 16, y: 41 },
  { x: 29, y: 8 },
  { x: 29, y: 21 },
  { x: 29, y: 34 },
  { x: 29, y: 47 },
  { x: 40, y: 15 },
  { x: 40, y: 27.5 },
  { x: 40, y: 40 },
];

/** A new board: eleven a side in their halves, numbered 1 to 11, and the ball on the centre spot. */
export function defaultScene(): TacticsScene {
  const side = (team: Team): PlayerToken[] =>
    HOME_LINEUP.map((at, index) => ({
      id: `p${team === "home" ? index + 1 : index + 12}`,
      kind: "player",
      team,
      label: String(index + 1),
      playerId: null,
      ...roundPoint({
        x: team === "home" ? at.x : PITCH_LENGTH - at.x,
        y: at.y,
      }),
    }));
  return {
    version: SCENE_VERSION,
    view: "full",
    tokens: [
      ...side("home"),
      ...side("away"),
      { id: "b1", kind: "ball", ...CENTRE },
    ],
    lines: [],
    steps: [],
  };
}

/** An empty pitch: only the ball on the centre spot, players added one by one. */
export function emptyScene(): TacticsScene {
  return {
    version: SCENE_VERSION,
    view: "full",
    tokens: [{ id: "b1", kind: "ball", ...CENTRE }],
    lines: [],
    steps: [],
  };
}

/**
 * A new scene for a view: the whole pitch starts with the default lineup, the
 * short corner with only the ball in the middle of the quarter, since the
 * lineup would stand almost wholly outside it.
 */
export function newScene(view: PitchView): TacticsScene {
  if (view === "full") return defaultScene();
  return {
    version: SCENE_VERSION,
    view,
    tokens: [{ id: "b1", kind: "ball", ...spawnPoint("ball", view) }],
    lines: [],
    steps: [],
  };
}

/** How far apart across the pitch new tokens appear in a short-corner quarter, in metres. */
const CORNER_SPAWN_SPREAD = 4;

/**
 * Where a newly added token appears. On the whole pitch: its team's half, or
 * the centre spot for the ball. In a short-corner quarter, which a team half
 * would miss: side by side in the middle of the quarter, the ball between.
 */
export function spawnPoint(
  kind: "ball" | Team,
  view: PitchView = "full",
): PitchPoint {
  if (view !== "full") {
    const { minX, maxX } = viewBounds(view);
    const offset = {
      ball: 0,
      home: -CORNER_SPAWN_SPREAD,
      away: CORNER_SPAWN_SPREAD,
    };
    return roundPoint({ x: (minX + maxX) / 2, y: CENTRE.y + offset[kind] });
  }
  if (kind === "ball") return CENTRE;
  const x = kind === "home" ? PITCH_LENGTH / 4 : (PITCH_LENGTH * 3) / 4;
  return roundPoint({ x, y: CENTRE.y });
}

/** The play tools the lines use, in the legend's order, each once. */
export function playToolsIn(lines: readonly BoardLine[]): PlayTool[] {
  return PLAY_TOOLS.filter((tool) => lines.some((line) => line.tool === tool));
}
