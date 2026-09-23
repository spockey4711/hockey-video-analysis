/**
 * Pure aggregation for the team overview report (P2-12): the per-game figures
 * summed over many games, per game and per player. It runs
 * {@link buildGameReport} on each game and adds the results, so a figure means
 * exactly what it means on a single game's report (a tag linking several
 * players counts for each of them, unknown tag types are skipped).
 *
 * Quarters are not part of the team overview - a quarter split summed over a
 * season says little - so each game is built without them.
 */
import {
  buildGameReport,
  compareRosterOrder,
  emptyFigures,
  sumFigures,
  type FigureRow,
  type PlayerFigures,
  type ReportPlayer,
  type ReportTag,
} from "./report";

/** A game as the team overview lists it. */
export interface TeamReportGame {
  readonly id: string;
  readonly title: string;
  readonly opponent: string | null;
  readonly playedOn: string | null;
}

/** A tag of any game, tied to the game it belongs to. */
export interface TeamReportTag extends ReportTag {
  readonly gameId: string;
}

/** The figures of one game. */
export interface GameFigures {
  readonly game: TeamReportGame;
  readonly figures: FigureRow;
}

/** The whole team overview. */
export interface TeamReport {
  readonly totals: FigureRow;
  /** Every game in the given order, including games with no tags. */
  readonly games: readonly GameFigures[];
  /**
   * Players linked to at least one tag in any of the games, in roster order,
   * each with their figures summed over all games.
   */
  readonly players: readonly PlayerFigures[];
  /** Tags linked to no (known) player, over all games. */
  readonly unassigned: FigureRow;
}

export interface TeamReportInput {
  /** The games to report on, in display order. */
  readonly games: readonly TeamReportGame[];
  /** Their tags; a tag of a game not in `games` is ignored. */
  readonly tags: readonly TeamReportTag[];
  readonly players: readonly ReportPlayer[];
}

/** Aggregate the tags of many games into the team overview. */
export function buildTeamReport(input: TeamReportInput): TeamReport {
  const tagsByGame = new Map<string, TeamReportTag[]>(
    input.games.map((game) => [game.id, []]),
  );
  for (const tag of input.tags) tagsByGame.get(tag.gameId)?.push(tag);

  let totals = emptyFigures();
  let unassigned = emptyFigures();
  const byPlayer = new Map<string, PlayerFigures>();

  const games = input.games.map((game) => {
    const report = buildGameReport({
      tags: tagsByGame.get(game.id) ?? [],
      players: input.players,
      quarters: [],
    });
    totals = sumFigures(totals, report.totals);
    unassigned = sumFigures(unassigned, report.unassigned);
    for (const { player, figures } of report.players) {
      const previous = byPlayer.get(player.id);
      byPlayer.set(player.id, {
        player,
        figures: previous ? sumFigures(previous.figures, figures) : figures,
      });
    }
    return { game, figures: report.totals };
  });

  return {
    totals,
    games,
    players: [...byPlayer.values()].sort((a, b) =>
      compareRosterOrder(a.player, b.player),
    ),
    unassigned,
  };
}
