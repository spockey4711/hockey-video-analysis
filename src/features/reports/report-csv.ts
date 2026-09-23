/**
 * The game report as a CSV download (P2-12). Pure: turns a built
 * {@link GameReport} into the file body and its file name, so the route handler
 * only authenticates, loads and responds.
 *
 * The export is one tidy table rather than several stacked blocks, so it sorts,
 * filters and pivots cleanly in a spreadsheet: every row is one slice of the
 * game (`Bereich` = Spiel / Viertel / Spieler) with the same count columns.
 */
import { reportsContent } from "./content";
import { toCsv, type CsvValue } from "./csv";
import type { FigureRow, GameReport } from "./report";

import { TAG_TYPES } from "@/lib/tag-types";

/**
 * UTF-8 byte-order mark. Excel only reads a CSV as UTF-8 (umlauts in names and
 * "Außerhalb der Viertel") when the file starts with it.
 */
export const REPORT_CSV_BOM = "﻿";

const { csv, quarters, players } = reportsContent;

function figureCells(figures: FigureRow): CsvValue[] {
  return [...TAG_TYPES.map((def) => figures.counts[def.key]), figures.total];
}

/** Serialize a game report into the CSV file body, BOM included. */
export function gameReportCsv(report: GameReport): string {
  const header: CsvValue[] = [
    csv.columns.section,
    csv.columns.name,
    csv.columns.jersey,
    ...TAG_TYPES.map((def) => def.label),
    csv.columns.total,
  ];

  const rows: CsvValue[][] = [
    header,
    [csv.sections.game, csv.gameRow, null, ...figureCells(report.totals)],
  ];

  if (report.quarters) {
    for (const row of report.quarters.rows) {
      rows.push([
        csv.sections.quarter,
        quarters.row(row.index),
        null,
        ...figureCells(row.figures),
      ]);
    }
    if (report.quarters.outside.total > 0) {
      rows.push([
        csv.sections.quarter,
        quarters.outside,
        null,
        ...figureCells(report.quarters.outside),
      ]);
    }
  }

  for (const row of report.players) {
    rows.push([
      csv.sections.player,
      row.player.name,
      row.player.jerseyNumber,
      ...figureCells(row.figures),
    ]);
  }
  rows.push([
    csv.sections.player,
    players.unassigned,
    null,
    ...figureCells(report.unassigned),
  ]);

  return REPORT_CSV_BOM + toCsv(rows);
}

/** Longest title slug kept in the file name, so the header stays short. */
const MAX_SLUG_LENGTH = 60;

const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
};

/** Lowercase ASCII slug: umlauts spelled out, anything else non-alnum to `-`. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => TRANSLITERATIONS[char] ?? char)
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");
}

/**
 * The download's file name, e.g. `spielbericht-2026-05-12-heim-vs-rot-weiss.csv`.
 * Strictly `[a-z0-9-]` plus the extension, so it is safe to place in a
 * `Content-Disposition` header without further quoting concerns. A malformed
 * date or an empty title is simply left out.
 */
export function reportCsvFileName(game: {
  readonly title: string;
  readonly playedOn: string | null;
}): string {
  const date =
    game.playedOn && /^\d{4}-\d{2}-\d{2}$/.test(game.playedOn)
      ? game.playedOn
      : null;
  const parts = [csv.fileStem, date, slugify(game.title)].filter(
    (part): part is string => Boolean(part),
  );
  return `${parts.join("-")}.csv`;
}
