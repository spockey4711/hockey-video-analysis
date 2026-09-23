import { describe, expect, it } from "vitest";

import { REPORT_CSV_BOM } from "@/features/reports/report-csv";
import { buildTeamReport } from "@/features/reports/team-report";
import {
  teamReportCsv,
  teamReportCsvFileName,
} from "@/features/reports/team-report-csv";

function lines(csv: string): string[] {
  expect(csv.startsWith(REPORT_CSV_BOM)).toBe(true);
  return csv.slice(REPORT_CSV_BOM.length).trimEnd().split("\r\n");
}

describe("teamReportCsv", () => {
  it("writes the team total, one row per game and per player", () => {
    const report = buildTeamReport({
      games: [
        {
          id: "g1",
          title: "=Derby",
          opponent: "Blau; Weiss",
          playedOn: "2026-05-12",
        },
        { id: "g2", title: " ", opponent: null, playedOn: null },
      ],
      tags: [
        { id: "t1", gameId: "g1", type: "goal", startS: 1, playerIds: ["p1"] },
        {
          id: "t2",
          gameId: "g2",
          type: "action_bad",
          startS: 1,
          playerIds: [],
        },
      ],
      players: [{ id: "p1", name: "Anna", jerseyNumber: 7 }],
    });

    expect(lines(teamReportCsv(report))).toEqual([
      "Bereich;Name;Nr.;Datum;Gegner;Tor;Ecke kurz;Aktion gut;Aktion schlecht;Gesamt",
      "Team;Gesamt;;;;1;0;0;1;2",
      'Spiel;\'=Derby;;2026-05-12;"Blau; Weiss";1;0;0;0;1',
      "Spiel;Unbenanntes Spiel;;;;0;0;0;1;1",
      "Spieler;Anna;7;;;1;0;0;0;1",
      "Spieler;Ohne Spieler;;;;0;0;0;1;1",
    ]);
  });

  it("keeps the no-player row when there are no games", () => {
    const report = buildTeamReport({ games: [], tags: [], players: [] });
    expect(lines(teamReportCsv(report))).toEqual([
      "Bereich;Name;Nr.;Datum;Gegner;Tor;Ecke kurz;Aktion gut;Aktion schlecht;Gesamt",
      "Team;Gesamt;;;;0;0;0;0;0",
      "Spieler;Ohne Spieler;;;;0;0;0;0;0",
    ]);
  });
});

describe("teamReportCsvFileName", () => {
  it("names the range ends that are set", () => {
    expect(teamReportCsvFileName({ from: null, to: null })).toBe(
      "teambericht.csv",
    );
    expect(teamReportCsvFileName({ from: "2026-01-01", to: null })).toBe(
      "teambericht-ab-2026-01-01.csv",
    );
    expect(teamReportCsvFileName({ from: null, to: "2026-03-31" })).toBe(
      "teambericht-bis-2026-03-31.csv",
    );
    expect(
      teamReportCsvFileName({ from: "2026-01-01", to: "2026-03-31" }),
    ).toBe("teambericht-ab-2026-01-01-bis-2026-03-31.csv");
  });
});
