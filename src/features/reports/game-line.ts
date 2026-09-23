/**
 * The "which game is this" line under the report title (P2-12): the game's
 * name, or the unnamed-game label for an auto-ingested game not titled yet,
 * followed by the opponent and the German-formatted date when known. Pure, so
 * the header component only renders it.
 */
import { reportsContent } from "./content";

import { gamesContent } from "@/features/games/content";
import { formatPlayedOn, isUnnamedGame } from "@/features/games/format";

/** A game's display name and its secondary facts, in display order. */
export interface ReportGameLine {
  readonly name: string;
  readonly meta: readonly string[];
}

export function reportGameLine(game: {
  readonly title: string;
  readonly opponent: string | null;
  readonly playedOn: string | null;
}): ReportGameLine {
  const playedOn = formatPlayedOn(game.playedOn);
  return {
    name: isUnnamedGame(game.title) ? gamesContent.list.unnamed : game.title,
    meta: [
      game.opponent ? reportsContent.opponent(game.opponent) : null,
      playedOn,
    ].filter((part): part is string => part !== null),
  };
}
