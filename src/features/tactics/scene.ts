/**
 * The tactics scene document (ADR 0010): what stands on the board and what is
 * drawn on it, stored as one versioned JSON value. Positions are pitch metres
 * (see `pitch.ts`), never pixels, so a scene looks the same on every screen.
 *
 * Every stored or submitted scene passes {@link parseScene} first. It checks
 * the shape, drops nothing silently and rejects the whole document on the first
 * bad value, so the database only ever holds scenes this module can draw.
 * Future versions add a `version` and an upgrade step here; nothing else reads
 * the raw JSON.
 */
import { roundPoint } from "./geometry";
import { BOARD_BOUNDS, CENTRE, PITCH_LENGTH, type PitchPoint } from "./pitch";

import {
  PEN_COLORS,
  STROKE_WIDTHS,
  type LineStyle,
  type PenColor,
  type StrokeWidth,
} from "@/features/player/telestration/state";

/** The scene format this code writes. */
export const SCENE_VERSION = 1;

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
 * What a board line is: a plain line, a straight arrow, or a curved arrow (the
 * telestration Schlenzer arrow).
 */
export type LineTool = "line" | "arrow" | "curve";
export const LINE_TOOLS: readonly LineTool[] = ["line", "arrow", "curve"];

/**
 * A line on the board, in the telestration look. A line or arrow keeps its two
 * ends; a curve keeps `[start, control, end]` of a quadratic Bezier, whose
 * control point may lie off the board for a strong bend.
 */
export interface BoardLine {
  readonly id: string;
  readonly tool: LineTool;
  readonly color: PenColor;
  readonly width: StrokeWidth;
  readonly style: LineStyle;
  readonly points: readonly PitchPoint[];
}

export interface TacticsScene {
  readonly version: typeof SCENE_VERSION;
  /** Tokens bottom to top: the last one is drawn over the others. */
  readonly tokens: readonly BoardToken[];
  /** Lines oldest first; they lie under the tokens. */
  readonly lines: readonly BoardLine[];
}

/** Limits that keep a scene a board, not a data dump. */
export const MAX_TOKENS = 40;
export const MAX_LINES = 60;
export const MAX_LABEL_LENGTH = 4;
/** Max length of the submitted JSON text, checked before parsing it. */
export const MAX_SCENE_JSON_LENGTH = 50_000;
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

function parseLine(value: unknown): BoardLine | null {
  if (!isObject(value) || typeof value.id !== "string") return null;
  if (!ID_RE.test(value.id)) return null;
  const { tool, color, width, style, points } = value;
  if (!isOneOf(LINE_TOOLS, tool) || !isOneOf(PEN_COLORS, color)) return null;
  if (!isOneOf(STROKE_WIDTHS, width)) return null;
  if (style !== "solid" && style !== "dotted") return null;
  if (!Array.isArray(points)) return null;
  if (points.length !== (tool === "curve" ? 3 : 2)) return null;
  const parsed = points.map((point, index) =>
    parsePoint(point, tool === "curve" && index === 1 ? CONTROL_MARGIN : 0),
  );
  if (parsed.some((point) => point === null)) return null;
  return {
    id: value.id,
    tool,
    color,
    width,
    style,
    points: parsed as PitchPoint[],
  };
}

/**
 * Validate an untrusted scene (parsed JSON), returning a clean copy or `null`.
 * Coordinates are rounded to the centimetre; ids must be unique across tokens
 * and lines, and a scene holds at most one ball.
 */
export function parseScene(value: unknown): TacticsScene | null {
  if (!isObject(value) || value.version !== SCENE_VERSION) return null;
  const { tokens, lines } = value;
  if (!Array.isArray(tokens) || tokens.length > MAX_TOKENS) return null;
  if (!Array.isArray(lines) || lines.length > MAX_LINES) return null;

  const parsedTokens = tokens.map(parseToken);
  const parsedLines = lines.map(parseLine);
  if (parsedTokens.some((token) => token === null)) return null;
  if (parsedLines.some((line) => line === null)) return null;
  const cleanTokens = parsedTokens as BoardToken[];
  const cleanLines = parsedLines as BoardLine[];

  const ids = [...cleanTokens, ...cleanLines].map((item) => item.id);
  if (new Set(ids).size !== ids.length) return null;
  if (cleanTokens.filter((token) => token.kind === "ball").length > 1)
    return null;
  return { version: SCENE_VERSION, tokens: cleanTokens, lines: cleanLines };
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
    tokens: [
      ...side("home"),
      ...side("away"),
      { id: "b1", kind: "ball", ...CENTRE },
    ],
    lines: [],
  };
}

/** Where a newly added token appears: its team's half, or the centre spot for the ball. */
export function spawnPoint(kind: "ball" | Team): PitchPoint {
  if (kind === "ball") return CENTRE;
  const x = kind === "home" ? PITCH_LENGTH / 4 : (PITCH_LENGTH * 3) / 4;
  return roundPoint({ x, y: CENTRE.y });
}
