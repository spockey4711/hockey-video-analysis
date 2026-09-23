import { describe, expect, it } from "vitest";

import { buildGameReport } from "@/features/reports/report";
import {
  gameReportCsv,
  reportCsvFileName,
  REPORT_CSV_BOM,
} from "@/features/reports/report-csv";

function lines(csv: string): string[] {
  expect(csv.startsWith(REPORT_CSV_BOM)).toBe(true);
  return csv.slice(REPORT_CSV_BOM.length).trimEnd().split("\r\n");
}

describe("gameReportCsv", () => {
  it("writes one tidy table: game total, quarters, players and unassigned", () => {
    const report = buildGameReport({
      tags: [
        { id: "t1", type: "goal", startS: 100, playerIds: ["p1"] },
        { id: "t2", type: "action_bad", startS: 1200, playerIds: [] },
        { id: "t3", type: "corner_short", startS: 5, playerIds: ["p1"] },
      ],
      players: [{ id: "p1", name: "=Anna; die Erste", jerseyNumber: 7 }],
      quarters: [
        { index: 1, startS: 60, endS: 960 },
        { index: 2, startS: 1000, endS: null },
      ],
    });

    expect(lines(gameReportCsv(report))).toEqual([
      "Bereich;Name;Nr.;Tor;Ecke kurz;Aktion gut;Aktion schlecht;Gesamt",
      "Spiel;Gesamt;;1;1;0;1;3",
      "Viertel;1. Viertel;;1;0;0;0;1",
      "Viertel;2. Viertel;;0;0;0;1;1",
      "Viertel;Außerhalb der Viertel;;0;1;0;0;1",
      'Spieler;"\'=Anna; die Erste";7;1;1;0;0;2',
      "Spieler;Ohne Spieler;;0;0;0;1;1",
    ]);
  });

  it("omits the quarter rows when no quarters are marked", () => {
    const report = buildGameReport({ tags: [], players: [], quarters: [] });
    expect(lines(gameReportCsv(report))).toEqual([
      "Bereich;Name;Nr.;Tor;Ecke kurz;Aktion gut;Aktion schlecht;Gesamt",
      "Spiel;Gesamt;;0;0;0;0;0",
      "Spieler;Ohne Spieler;;0;0;0;0;0",
    ]);
  });

  it("keeps the zero outside-quarters row so every export has one row set", () => {
    const report = buildGameReport({
      tags: [{ id: "t1", type: "goal", startS: 100, playerIds: [] }],
      players: [],
      quarters: [{ index: 1, startS: 0, endS: null }],
    });
    expect(lines(gameReportCsv(report))).toContain(
      "Viertel;Außerhalb der Viertel;;0;0;0;0;0",
    );
  });
});

describe("reportCsvFileName", () => {
  it("builds an ASCII file name from the date and the title", () => {
    expect(
      reportCsvFileName({
        title: "Heim vs. Rot-Weiß Köln",
        playedOn: "2026-05-12",
      }),
    ).toBe("spielbericht-2026-05-12-heim-vs-rot-weiss-koeln.csv");
  });

  it("drops a missing date and falls back for an unnamed game", () => {
    expect(reportCsvFileName({ title: "  ", playedOn: null })).toBe(
      "spielbericht.csv",
    );
    expect(reportCsvFileName({ title: "Derby", playedOn: "kaputt" })).toBe(
      "spielbericht-derby.csv",
    );
  });

  it("strips anything that could break the header and caps the length", () => {
    const name = reportCsvFileName({
      title: `"; filename=evil.exe\r\n${"x".repeat(200)}`,
      playedOn: null,
    });
    expect(name).toMatch(/^spielbericht-[a-z0-9-]+\.csv$/);
    expect(name.length).toBeLessThanOrEqual(100);
  });
});
