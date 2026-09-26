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
