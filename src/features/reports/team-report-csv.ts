/**
 * The team overview as a CSV download (P2-12). Pure, like the per-game export
 * in `report-csv.ts`, and written in the same dialect and shape: one tidy table
 * whose rows are slices (`Bereich` = Team / Spiel / Spieler) with the same count
 * columns, so it sorts and pivots cleanly in a spreadsheet. Game rows also carry
 * their ISO date and opponent; the "no player" row is always written.
 */
import { reportsContent } from "./content";
import { toCsv, type CsvValue } from "./csv";
import type { FigureRow } from "./report";
import { REPORT_CSV_BOM } from "./report-csv";
import type { ReportRange } from "./report-range";
import type { TeamReport } from "./team-report";

import { gamesContent } from "@/features/games/content";
import { isUnnamedGame } from "@/features/games/format";
import { TAG_TYPES } from "@/lib/tag-types";

const { csv, players, team } = reportsContent;

function figureCells(figures: FigureRow): CsvValue[] {
  return [...TAG_TYPES.map((def) => figures.counts[def.key]), figures.total];
}

/** Serialize the team overview into the CSV file body, BOM included. */
export function teamReportCsv(report: TeamReport): string {
  const rows: CsvValue[][] = [
    [
      csv.columns.section,
      csv.columns.name,
      csv.columns.jersey,
      team.csv.columns.date,
      team.csv.columns.opponent,
      ...TAG_TYPES.map((def) => def.label),
      csv.columns.total,
    ],
    [
      team.csv.sections.team,
      csv.gameRow,
      null,
      null,
      null,
      ...figureCells(report.totals),
    ],
  ];

  for (const { game, figures } of report.games) {
    rows.push([
      csv.sections.game,
      isUnnamedGame(game.title) ? gamesContent.list.unnamed : game.title,
      null,
      game.playedOn,
      game.opponent,
      ...figureCells(figures),
    ]);
  }

  for (const { player, figures } of report.players) {
    rows.push([
      csv.sections.player,
      player.name,
      player.jerseyNumber,
      null,
      null,
      ...figureCells(figures),
    ]);
  }
  rows.push([
    csv.sections.player,
    players.unassigned,
    null,
    null,
    null,
    ...figureCells(report.unassigned),
  ]);

  return REPORT_CSV_BOM + toCsv(rows);
}

/**
 * The download's file name, e.g. `teambericht-ab-2026-01-01-bis-2026-03-31.csv`,
 * or `teambericht.csv` for all games. The range ends are validated ISO dates, so
 * the name stays strictly `[a-z0-9-]` plus the extension.
 */
export function teamReportCsvFileName(range: ReportRange): string {
  const parts = [
    team.csv.fileStem,
    ...(range.from ? [team.csv.fromWord, range.from] : []),
    ...(range.to ? [team.csv.toWord, range.to] : []),
  ];
  return `${parts.join("-")}.csv`;
}
