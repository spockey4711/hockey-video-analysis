/**
 * Display rows for the report's breakdown tables (P2-12). Pure: maps a built
 * {@link GameReport} onto labelled rows so the table component only renders,
 * with no business logic in JSX. The CSV export applies the same rules in
 * `report-csv.ts`; both read their labels from {@link reportsContent}.
 */
import { reportsContent } from "./content";
import type { FigureRow, GameReport } from "./report";

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
 * when there are any).
 */
export function playerBreakdownRows(report: GameReport): BreakdownRow[] {
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
