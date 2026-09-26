/**
 * Accessible names for what stands on the board, and the label a roster
 * player gives a token. Pure, so the board and the selection panel name
 * things the same way.
 */
import { tacticsContent } from "./content";
import type { BoardRosterPlayer } from "./queries";
import {
  MAX_LABEL_LENGTH,
  type BoardLine,
  type BoardShape,
  type BoardToken,
  type TacticsScene,
} from "./scene";

const { board } = tacticsContent;

/** "Heim 7", "Gast 3, <roster name>", or "Ball". */
export function describeToken(
  token: BoardToken,
  roster: readonly BoardRosterPlayer[],
): string {
  if (token.kind === "ball") return board.ball;
  const team = board.teams[token.team];
  const base = token.label ? `${team} ${token.label}` : team;
  const player = token.playerId
    ? roster.find((candidate) => candidate.id === token.playerId)
    : undefined;
  return player ? `${base}, ${player.name}` : base;
}

/** "Pfeil 2": the line's kind and its place among the lines of that kind. */
export function describeLine(line: BoardLine, scene: TacticsScene): string {
  const sameKind = scene.lines.filter((other) => other.tool === line.tool);
  return board.line(board.modes[line.tool], sameKind.indexOf(line) + 1);
}

/**
 * "Rechteck 2": a zone's kind and its place among the zones of that kind; a
 * text by what it says.
 */
export function describeShape(shape: BoardShape, scene: TacticsScene): string {
  if (shape.kind === "text") return board.text(shape.text);
  const sameKind = scene.shapes.filter((other) => other.kind === shape.kind);
  return board.line(board.modes[shape.kind], sameKind.indexOf(shape) + 1);
}

/**
 * The label a token gets when it is linked to a roster player: the shirt
 * number, or the initials when the player has none.
 */
export function rosterLabel(player: BoardRosterPlayer): string {
  if (player.jerseyNumber !== null) return String(player.jerseyNumber);
  const initials = player.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => [...part][0]?.toUpperCase() ?? "")
    .join("");
  return [...initials].slice(0, MAX_LABEL_LENGTH).join("");
}

/**
 * The short names roster players go by under their discs: the first name, or
 * the first name and the initial of the last when two players share a first
 * name, or the whole name when that still does not tell them apart.
 */
export function shortNames(
  roster: readonly BoardRosterPlayer[],
): ReadonlyMap<string, string> {
  const parts = new Map(
    roster.map((player) => [
      player.id,
      player.name.split(/\s+/).filter(Boolean),
    ]),
  );
  const first = (id: string) => parts.get(id)?.[0] ?? "";
  const initialled = (id: string) => {
    const words = parts.get(id) ?? [];
    const last = words.length > 1 ? words[words.length - 1] : undefined;
    return last
      ? `${first(id)} ${[...last][0]?.toUpperCase() ?? ""}.`
      : first(id);
  };
  const count = (names: readonly string[], name: string) =>
    names.filter((other) => other === name).length;
  const firsts = roster.map((player) => first(player.id));
  const initials = roster.map((player) => initialled(player.id));
  return new Map(
    roster.map((player, index) => {
      const name = firsts[index] ?? "";
      if (count(firsts, name) === 1) return [player.id, name];
      const short = initials[index] ?? "";
      if (count(initials, short) === 1) return [player.id, short];
      return [player.id, player.name.trim()];
    }),
  );
}

/**
 * What each player on the board shows under its disc when names are shown,
 * by token id: the roster player's short name. Only tokens linked to a player
 * on the given roster get one, so a scene without roster links, as every
 * login-free page gets it, names nobody.
 */
export function tokenNames(
  tokens: readonly BoardToken[],
  roster: readonly BoardRosterPlayer[],
): ReadonlyMap<string, string> {
  const names = shortNames(roster);
  return new Map(
    tokens.flatMap((token) => {
      if (token.kind !== "player" || !token.playerId) return [];
      const name = names.get(token.playerId);
      return name ? [[token.id, name] as const] : [];
    }),
  );
}
