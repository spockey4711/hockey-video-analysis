/**
 * The messages between the two windows of a presentation on a second screen
 * (ADR 0015): the presenter window on the laptop, which drives, and the
 * audience window on the projector, which only shows. They talk over a
 * `BroadcastChannel` named after a random session id, so only the two windows
 * of one presentation in one browser hear each other.
 *
 * The audience gets only what it draws: the clips' and scenes' pictures, the
 * title cards, the drawing, the pointer, the board and the markers. Presenter
 * notes, the coach's scene list, the view counting's share token and the
 * clips' comments have no field here, so no message can carry them; every
 * builder below copies the fields it sends one by one rather than spreading
 * the presenter's data, so a field added there later stays on the laptop.
 *
 * Kept free of React and the DOM, with a parser for each direction, so the
 * protocol is unit-tested on its own and the native Mac app (M12) can follow
 * the same shapes.
 */
import type { TitleCard } from "./title-cards";

import type { PlaybackPlan } from "@/features/clip-edits/playback";
import type { PicturePoint } from "@/features/player/telestration/geometry";
import type { Stroke } from "@/features/player/telestration/state";
import type { PlaylistEntry } from "@/features/share/playlist/types";
import type { Playback } from "@/features/tactics/board-state";
import {
  parseScene,
  withoutRosterLinks,
  type BoardLine,
  type TacticsScene,
} from "@/features/tactics/scene";

/**
 * Bumped on any change the other side could misread. A window that hears
 * another version (one tab loaded before a deploy, one after) asks for a
 * reload instead of guessing.
 */
export const AUDIENCE_PROTOCOL_VERSION = 1;

/** Where the audience window loads: a login-free page with no data of its own. */
export const AUDIENCE_PATH = "/share/present";

/**
 * The audience window's name. Opening it again finds the same window, so it
 * stays on the projector, instead of opening a second one.
 */
export const AUDIENCE_WINDOW_NAME = "hockey-presentation-audience";

const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;

/** The channel the two windows of the presentation `sessionId` share. */
export function audienceChannelName(sessionId: string): string {
  return `hva-presentation:${sessionId}`;
}

/**
 * The audience window's address. The session id rides in the fragment, which
 * the browser never sends to the server.
 */
export function audienceUrl(sessionId: string): string {
  return `${AUDIENCE_PATH}#${sessionId}`;
}

/** The session id in an audience window's `location.hash`, or `null` if none. */
export function sessionIdFromHash(hash: string): string | null {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  return SESSION_ID.test(id) ? id : null;
}

/** A clip as the audience plays it: its picture and how it plays, no more. */
export interface AudienceClip {
  readonly kind: "clip";
  readonly id: string;
  readonly src: string;
  /** The video's accessible title. */
  readonly title: string;
  readonly plan?: PlaybackPlan;
  readonly frameRate?: number | null;
}

/** A tactics scene entry as the audience plays it, without roster links. */
export interface AudienceScene {
  readonly kind: "scene";
  readonly id: string;
  /** The drawing's accessible name. */
  readonly title: string;
  readonly scene: TacticsScene;
  readonly holdS: number;
}

export type AudienceEntry = AudienceClip | AudienceScene;

/**
 * How the entry on screen plays, read off the presenter's player as the
 * message is sent. The audience plays along on its own clock and only seeks
 * when it drifts off.
 */
export interface AudienceMedia {
  /** Whether it plays, as its transport shows it; a marker's hold counts as playing. */
  readonly playing: boolean;
  /** Whether a marker holds the picture still while it plays. */
  readonly held: boolean;
  /**
   * Where the clip is on its file's clock, in seconds; `null` for a scene,
   * which runs on a clock of its own from its start.
   */
  readonly time: number | null;
  /** The playback rate: 1, or less in slow motion. */
  readonly rate: number;
  /** When `time` was read, in milliseconds since the epoch. */
  readonly at: number;
}

/** The tactics board on show: what it draws at this moment. */
export interface AudienceBoard {
  readonly scene: TacticsScene;
  readonly step: number;
  readonly playback: Playback | null;
  /** The line being drawn right now. */
  readonly draft: BoardLine | null;
}

/** Everything the audience window shows, besides the pointer's position. */
export interface AudienceState {
  /** The entry on screen, an index into the session's entries. */
  readonly index: number;
  /** The title card over it, or `null` once the viewer is past the cards. */
  readonly card: TitleCard | null;
  readonly showMarks: boolean;
  /** The presenter's drawing, the stroke being drawn included; `null` while none is up. */
  readonly drawing: readonly Stroke[] | null;
  /** Whether the laser pointer is on. */
  readonly pointer: boolean;
  /** The tactics board, or `null` while it is put away. */
  readonly board: AudienceBoard | null;
  readonly media: AudienceMedia;
}

/** What the presenter can be asked to do from the audience window's keys. */
export type AudienceCommand = "next" | "previous" | "toggle-play";

const COMMANDS: readonly AudienceCommand[] = [
  "next",
  "previous",
  "toggle-play",
];

/** Presenter to audience. */
export type PresenterMessage =
  | {
      readonly v: typeof AUDIENCE_PROTOCOL_VERSION;
      readonly type: "session";
      readonly entries: readonly AudienceEntry[];
      readonly state: AudienceState;
    }
  | {
      readonly v: typeof AUDIENCE_PROTOCOL_VERSION;
      readonly type: "state";
      readonly state: AudienceState;
    }
  | {
      readonly v: typeof AUDIENCE_PROTOCOL_VERSION;
      readonly type: "pointer";
      /** On the picture, both axes 0 to 1; `null` when the pointer left it. */
      readonly at: PicturePoint | null;
    }
  | { readonly v: typeof AUDIENCE_PROTOCOL_VERSION; readonly type: "end" };

/** Audience to presenter. */
export type AudienceMessage =
  | { readonly v: typeof AUDIENCE_PROTOCOL_VERSION; readonly type: "hello" }
  | { readonly v: typeof AUDIENCE_PROTOCOL_VERSION; readonly type: "bye" }
  | {
      readonly v: typeof AUDIENCE_PROTOCOL_VERSION;
      readonly type: "command";
      readonly command: AudienceCommand;
    };

/** A parsed message, or why it was dropped. */
export type Parsed<T> =
  | { readonly ok: true; readonly message: T }
  | { readonly ok: false; readonly reason: "version" | "shape" };

const v = AUDIENCE_PROTOCOL_VERSION;

export function sessionMessage(
  entries: readonly AudienceEntry[],
  state: AudienceState,
): PresenterMessage {
  return { v, type: "session", entries, state };
}

export function stateMessage(state: AudienceState): PresenterMessage {
  return { v, type: "state", state };
}

export function pointerMessage(at: PicturePoint | null): PresenterMessage {
  return { v, type: "pointer", at: at && { x: at.x, y: at.y } };
}

export const endMessage: PresenterMessage = { v, type: "end" };
export const helloMessage: AudienceMessage = { v, type: "hello" };
export const byeMessage: AudienceMessage = { v, type: "bye" };

export function commandMessage(command: AudienceCommand): AudienceMessage {
  return { v, type: "command", command };
}

/**
 * The entries of the presentation as the audience gets them: each field it
 * draws copied by name, and a scene without its roster links.
 */
export function audienceEntries(
  items: readonly PlaylistEntry[],
): AudienceEntry[] {
  return items.map((item): AudienceEntry => {
    if (item.kind === "scene") {
      return {
        kind: "scene",
        id: item.id,
        title: item.title,
        scene: withoutRosterLinks(item.scene),
        holdS: item.holdS,
      };
    }
    const clip = item;
    return {
      kind: "clip",
      id: clip.id,
      src: clip.src,
      title: clip.title,
      ...(clip.plan && { plan: clip.plan }),
      ...(clip.frameRate !== undefined && { frameRate: clip.frameRate }),
    };
  });
}

/** The board as the audience gets it: the scene on show, without roster links. */
export function audienceBoard(board: AudienceBoard): AudienceBoard {
  return {
    scene: withoutRosterLinks(board.scene),
    step: board.step,
    playback: board.playback && {
      time: board.playback.time,
      playing: board.playback.playing,
    },
    draft: board.draft,
  };
}

/** A presenter message from the channel, checked before the audience uses it. */
export function parsePresenterMessage(raw: unknown): Parsed<PresenterMessage> {
  const envelope = parseEnvelope(raw);
  if (!envelope.ok) return envelope;
  const value = envelope.value;
  switch (value.type) {
    case "session": {
      if (!Array.isArray(value.entries)) return SHAPE;
      const entries = value.entries.map(parseEntry);
      const state = parseState(value.state);
      if (!state || entries.some((entry) => entry === null)) return SHAPE;
      if (state.index >= entries.length) return SHAPE;
      return ok(sessionMessage(entries as AudienceEntry[], state));
    }
    case "state": {
      const state = parseState(value.state);
      return state ? ok(stateMessage(state)) : SHAPE;
    }
    case "pointer": {
      if (value.at === null) return ok(pointerMessage(null));
      const at = parsePoint(value.at, "picture");
      return at ? ok(pointerMessage(at)) : SHAPE;
    }
    case "end":
      return ok(endMessage);
    default:
      return SHAPE;
  }
}

/** An audience message from the channel, checked before the presenter acts on it. */
export function parseAudienceMessage(raw: unknown): Parsed<AudienceMessage> {
  const envelope = parseEnvelope(raw);
  if (!envelope.ok) return envelope;
  const value = envelope.value;
  switch (value.type) {
    case "hello":
      return ok(helloMessage);
    case "bye":
      return ok(byeMessage);
    case "command":
      return isOneOf(COMMANDS, value.command)
        ? ok(commandMessage(value.command))
        : SHAPE;
    default:
      return SHAPE;
  }
}

type Json = Record<string, unknown>;

const SHAPE = { ok: false, reason: "shape" } as const;

function ok<T>(message: T): Parsed<T> {
  return { ok: true, message };
}

function parseEnvelope(
  raw: unknown,
):
  | { readonly ok: true; readonly value: Json }
  | { readonly ok: false; readonly reason: "version" | "shape" } {
  if (!isObject(raw) || typeof raw.type !== "string") return SHAPE;
  if (raw.v !== AUDIENCE_PROTOCOL_VERSION) {
    return { ok: false, reason: "version" };
  }
  return { ok: true, value: raw };
}

function parseEntry(raw: unknown): AudienceEntry | null {
  if (!isObject(raw) || !isText(raw.id) || !isText(raw.title)) return null;
  if (raw.kind === "scene") {
    const scene = parseScene(raw.scene);
    if (!scene || !isNumber(raw.holdS) || raw.holdS <= 0) return null;
    return {
      kind: "scene",
      id: raw.id,
      title: raw.title,
      scene,
      holdS: raw.holdS,
    };
  }
  if (raw.kind !== "clip" || !isText(raw.src)) return null;
  const plan = raw.plan === undefined ? undefined : parsePlan(raw.plan);
  if (plan === null) return null;
  const frameRate = raw.frameRate;
  if (
    frameRate !== undefined &&
    frameRate !== null &&
    !(isNumber(frameRate) && frameRate > 0)
  ) {
    return null;
  }
  return {
    kind: "clip",
    id: raw.id,
    src: raw.src,
    title: raw.title,
    ...(plan && { plan }),
    ...(frameRate !== undefined && { frameRate }),
  };
}

/**
 * A playback plan, checked for the shape the stage reads. The plan is built
 * on the presenter's server and only passed through, so this guards against
 * a garbled message rather than re-validating the edit.
 */
function parsePlan(raw: unknown): PlaybackPlan | null {
  if (!isObject(raw) || !isNumber(raw.inS) || !isNumber(raw.outS)) {
    return null;
  }
  if (raw.outS < raw.inS) return null;
  if (
    !Array.isArray(raw.slow) ||
    !Array.isArray(raw.zoom) ||
    !Array.isArray(raw.marks) ||
    typeof raw.exact !== "boolean" ||
    typeof raw.trimClamped !== "boolean"
  ) {
    return null;
  }
  return raw as unknown as PlaybackPlan;
}

function parseState(raw: unknown): AudienceState | null {
  if (!isObject(raw)) return null;
  const { index, card, showMarks, drawing, pointer, board, media } = raw;
  if (!isIndex(index) || typeof showMarks !== "boolean") return null;
  if (typeof pointer !== "boolean") return null;
  const parsedCard = card === null ? null : parseCard(card);
  const parsedDrawing = drawing === null ? null : parseStrokes(drawing);
  const parsedBoard = board === null ? null : parseBoard(board);
  const parsedMedia = parseMedia(media);
  if (card !== null && !parsedCard) return null;
  if (drawing !== null && !parsedDrawing) return null;
  if (board !== null && !parsedBoard) return null;
  if (!parsedMedia) return null;
  return {
    index,
    card: parsedCard,
    showMarks,
    drawing: parsedDrawing,
    pointer,
    board: parsedBoard,
    media: parsedMedia,
  };
}

function parseCard(raw: unknown): TitleCard | null {
  if (!isObject(raw) || !isText(raw.text)) return null;
  if (raw.kind !== "intro" && raw.kind !== "clip") return null;
  return { kind: raw.kind, text: raw.text };
}

const DRAW_TOOLS = ["arrow", "curve", "circle", "freehand"] as const;
const PEN_COLORS = ["red", "yellow", "blue", "white"] as const;
const STROKE_WIDTHS = ["thin", "medium", "thick"] as const;
const LINE_STYLES = ["solid", "dotted"] as const;
const LINE_TOOLS = ["line", "arrow", "curve"] as const;

function parseStrokes(raw: unknown): Stroke[] | null {
  if (!Array.isArray(raw)) return null;
  const strokes: Stroke[] = [];
  for (const item of raw) {
    if (!isObject(item) || !isOneOf(DRAW_TOOLS, item.tool)) return null;
    if (!isOneOf(PEN_COLORS, item.color)) return null;
    if (!isOneOf(STROKE_WIDTHS, item.width)) return null;
    if (!isOneOf(LINE_STYLES, item.style)) return null;
    const points = parsePoints(item.points, "picture");
    if (!points) return null;
    strokes.push({
      tool: item.tool,
      color: item.color,
      width: item.width,
      style: item.style,
      points,
    });
  }
  return strokes;
}

function parseBoard(raw: unknown): AudienceBoard | null {
  if (!isObject(raw) || !isIndex(raw.step)) return null;
  const scene = parseScene(raw.scene);
  if (!scene) return null;
  const { playback, draft } = raw;
  let parsedPlayback: Playback | null = null;
  if (playback !== null) {
    if (
      !isObject(playback) ||
      !isNumber(playback.time) ||
      typeof playback.playing !== "boolean"
    ) {
      return null;
    }
    parsedPlayback = { time: playback.time, playing: playback.playing };
  }
  const parsedDraft = draft === null ? null : parseLine(draft);
  if (draft !== null && !parsedDraft) return null;
  return {
    scene,
    step: raw.step,
    playback: parsedPlayback,
    draft: parsedDraft,
  };
}

/** A board line being drawn, in pitch metres. */
function parseLine(raw: unknown): BoardLine | null {
  if (!isObject(raw) || !isText(raw.id) || !isIndex(raw.step)) return null;
  if (!isOneOf(LINE_TOOLS, raw.tool) || !isOneOf(PEN_COLORS, raw.color)) {
    return null;
  }
  if (!isOneOf(STROKE_WIDTHS, raw.width) || !isOneOf(LINE_STYLES, raw.style)) {
    return null;
  }
  const points = parsePoints(raw.points, "pitch");
  if (!points) return null;
  return {
    id: raw.id,
    tool: raw.tool,
    color: raw.color,
    width: raw.width,
    style: raw.style,
    points,
    step: raw.step,
  };
}

function parseMedia(raw: unknown): AudienceMedia | null {
  if (!isObject(raw)) return null;
  const { playing, held, time, rate, at } = raw;
  if (typeof playing !== "boolean" || typeof held !== "boolean") return null;
  if (time !== null && !(isNumber(time) && time >= 0)) return null;
  if (!isNumber(rate) || rate <= 0 || !isNumber(at)) return null;
  return { playing, held, time, rate, at };
}

/**
 * Where a point lies: on the `picture`, both axes 0 to 1, or on the `pitch`,
 * in metres, where a curve's control point may lie off the board.
 */
type PointSpace = "picture" | "pitch";

function parsePoints(
  raw: unknown,
  space: PointSpace,
): { x: number; y: number }[] | null {
  if (!Array.isArray(raw)) return null;
  const points: { x: number; y: number }[] = [];
  for (const item of raw) {
    const point = parsePoint(item, space);
    if (!point) return null;
    points.push(point);
  }
  return points;
}

function parsePoint(
  raw: unknown,
  space: PointSpace,
): { x: number; y: number } | null {
  if (!isObject(raw) || !isNumber(raw.x) || !isNumber(raw.y)) return null;
  const onPicture = raw.x >= 0 && raw.x <= 1 && raw.y >= 0 && raw.y <= 1;
  if (space === "picture" && !onPicture) return null;
  return { x: raw.x, y: raw.y };
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIndex(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return values.some((candidate) => candidate === value);
}
