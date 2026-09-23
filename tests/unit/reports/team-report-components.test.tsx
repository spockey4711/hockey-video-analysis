import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildTeamReport,
  gameBreakdownRows,
  ReportBreakdownTable,
  ReportRangeForm,
  reportRangeFacts,
  reportsContent,
  TeamReportHeader,
} from "@/features/reports";

afterEach(cleanup);

const { team } = reportsContent;

const report = buildTeamReport({
  games: [
    { id: "g1", title: "Derby", opponent: "Blau", playedOn: "2026-05-12" },
    { id: "g2", title: "", opponent: null, playedOn: null },
  ],
  tags: [
    { id: "t1", gameId: "g1", type: "goal", startS: 1, playerIds: [] },
    { id: "t2", gameId: "g2", type: "goal", startS: 1, playerIds: [] },
  ],
  players: [],
});

describe("gameBreakdownRows", () => {
  it("labels each game with its opponent and date and links its report", () => {
    expect(
      gameBreakdownRows(report).map((row) => [
        row.label,
        row.prefix,
        row.href,
        row.figures.total,
      ]),
    ).toEqual([
      ["Derby vs. Blau", "12.05.2026", "/games/g1/report", 1],
      ["Unbenanntes Spiel", null, "/games/g2/report", 1],
    ]);
  });
});

describe("reportRangeFacts", () => {
  it("names the open range and each set end in German dates", () => {
    expect(reportRangeFacts({ from: null, to: null })).toEqual([team.allGames]);
    expect(reportRangeFacts({ from: "2026-01-01", to: "2026-03-31" })).toEqual([
      "ab 01.01.2026",
      "bis 31.03.2026",
    ]);
    expect(reportRangeFacts({ from: null, to: "2026-03-31" })).toEqual([
      "bis 31.03.2026",
    ]);
  });
});

describe("ReportBreakdownTable", () => {
  it("links a row label that has a target", () => {
    render(
      <ReportBreakdownTable
        title={team.games.heading}
        rowHeader={team.table.game}
        rows={gameBreakdownRows(report)}
      />,
    );
    const table = screen.getByRole("region", { name: team.games.heading });
    expect(
      within(table).getByRole("link", { name: "Derby vs. Blau" }),
    ).toHaveAttribute("href", "/games/g1/report");
  });
});

describe("TeamReportHeader", () => {
  it("shows the facts and links the CSV export for the same range", () => {
    render(
      <TeamReportHeader
        summary={{
          facts: ["ab 01.01.2026", "2 Spiele"],
          csvHref: "/reports/csv?from=2026-01-01",
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: team.title }),
    ).toBeInTheDocument();
    expect(screen.getByText("ab 01.01.2026 · 2 Spiele")).toBeInTheDocument();
    const download = screen.getByRole("link", {
      name: reportsContent.download,
    });
    expect(download).toHaveAttribute("href", "/reports/csv?from=2026-01-01");
    expect(download).toHaveAttribute("download");
  });

  it("shows the subtitle and no action while loading", () => {
    render(<TeamReportHeader summary={null} />);
    expect(screen.getByText(team.subtitle)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("ReportRangeForm", () => {
  it("prefills the range and offers a reset while one is set", () => {
    render(
      <ReportRangeForm
        action="/reports"
        range={{ from: "2026-01-01", to: null }}
      />,
    );
    expect(screen.getByLabelText(team.range.from)).toHaveValue("2026-01-01");
    expect(screen.getByLabelText(team.range.to)).toHaveValue("");
    expect(
      screen.getByRole("link", { name: team.range.reset }),
    ).toHaveAttribute("href", "/reports");
  });

  it("hides the reset for the open range", () => {
    render(
      <ReportRangeForm action="/reports" range={{ from: null, to: null }} />,
    );
    expect(
      screen.queryByRole("link", { name: team.range.reset }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: team.range.apply }),
    ).toHaveAttribute("type", "submit");
  });
});
