/**
 * Display rows for the report's breakdown tables (P2-12). Pure: maps a built
 * {@link GameReport} onto labelled rows so the table component only renders,
 * with no business logic in JSX. The CSV export applies the same rules in
 * `report-csv.ts`; both read their labels from {@link reportsContent}.
 */
import { reportsContent } from "./content";
import type { FigureRow, GameReport } from "./report";
import type { TeamReport } from "./team-report";

import { gamesContent } from "@/features/games/content";
import { formatPlayedOn, isUnnamedGame } from "@/features/games/format";

/** One labelled row of a breakdown table. */
export interface BreakdownRow {
  /** Stable React key. */
  readonly key: string;
  readonly label: string;
  /** Optional short prefix before the label (a jersey number). */
  readonly prefix: string | null;
  readonly figures: FigureRow;
  /** A catch-all row (outside quarters, no player), rendered subdued. */
  readonly isRemainder: boolean;
  /** Where the row label links to, if anywhere (a game's own report). */
  readonly href?: string;
}

const { quarters, players } = reportsContent;

/**
 * The per-quarter rows, or `null` when no quarters are marked. The row for tags
 * outside every quarter only appears when it holds any.
 */
export function quarterBreakdownRows(
  report: GameReport,
): BreakdownRow[] | null {
  if (!report.quarters) return null;
  const rows: BreakdownRow[] = report.quarters.rows.map((row) => ({
    key: `quarter-${row.index}`,
    label: quarters.row(row.index),
    prefix: null,
    figures: row.figures,
    isRemainder: false,
  }));
  if (report.quarters.outside.total > 0) {
    rows.push({
      key: "quarter-outside",
      label: quarters.outside,
      prefix: null,
      figures: report.quarters.outside,
      isRemainder: true,
    });
  }
  return rows;
}

/**
 * The per-player rows in roster order, then the tags linked to no player (only
 * when there are any). Works on a game report and on the team overview alike.
 */
export function playerBreakdownRows(
  report: Pick<GameReport | TeamReport, "players" | "unassigned">,
): BreakdownRow[] {
  const rows: BreakdownRow[] = report.players.map(({ player, figures }) => ({
    key: `player-${player.id}`,
    label: player.name,
    prefix:
      player.jerseyNumber === null ? null : players.jersey(player.jerseyNumber),
    figures,
    isRemainder: false,
  }));
  if (report.unassigned.total > 0) {
    rows.push({
      key: "player-unassigned",
      label: players.unassigned,
      prefix: null,
      figures: report.unassigned,
      isRemainder: true,
    });
  }
  return rows;
}

/**
 * The team overview's per-game rows, in the report's game order: the game's
 * name (plus its opponent) prefixed with its date, linking to its own report.
 */
export function gameBreakdownRows(report: TeamReport): BreakdownRow[] {
  return report.games.map(({ game, figures }) => {
    const name = isUnnamedGame(game.title)
      ? gamesContent.list.unnamed
      : game.title;
    return {
      key: `game-${game.id}`,
      label: game.opponent
        ? `${name} ${reportsContent.opponent(game.opponent)}`
        : name,
      prefix: formatPlayedOn(game.playedOn),
      figures,
      isRemainder: false,
      href: `/games/${game.id}/report`,
    };
  });
}
