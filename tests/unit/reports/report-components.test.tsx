import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildGameReport,
  playerBreakdownRows,
  ReportBreakdownTable,
  ReportFigures,
  ReportHeader,
  reportsContent,
} from "@/features/reports";

afterEach(cleanup);

const report = buildGameReport({
  tags: [
    { id: "t1", type: "goal", startS: 10, playerIds: ["p1"] },
    { id: "t2", type: "goal", startS: 20, playerIds: [] },
    { id: "t3", type: "action_bad", startS: 30, playerIds: ["p1"] },
  ],
  players: [{ id: "p1", name: "Anna", jerseyNumber: 7 }],
  quarters: [],
});

describe("ReportHeader", () => {
  it("links back to tagging and to the CSV export route", () => {
    render(
      <ReportHeader
        game={{ id: "g1", name: "Derby", meta: ["vs. Blau", "12.05.2026"] }}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: reportsContent.title }),
    ).toBeInTheDocument();
    expect(screen.getByText("Derby")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: reportsContent.toTagging }),
    ).toHaveAttribute("href", "/games/g1/watch");
    const download = screen.getByRole("link", {
      name: reportsContent.download,
    });
    expect(download).toHaveAttribute("href", "/games/g1/report/csv");
    expect(download).toHaveAttribute("download");
  });

  it("renders only the frame while loading", () => {
    render(<ReportHeader game={null} />);
    expect(
      screen.queryByRole("link", { name: reportsContent.download }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(reportsContent.subtitle)).toBeInTheDocument();
  });
});

describe("ReportFigures", () => {
  it("shows one count per tag type plus the total", () => {
    render(<ReportFigures totals={report.totals} />);
    const goal = screen.getByText("Tor").closest("div");
    expect(goal).not.toBeNull();
    expect(within(goal as HTMLElement).getByText("2")).toBeInTheDocument();
    const total = screen.getByText(reportsContent.figures.total).closest("div");
    expect(within(total as HTMLElement).getByText("3")).toBeInTheDocument();
  });
});

describe("ReportBreakdownTable", () => {
  it("renders one table row per breakdown row with its counts", () => {
    render(
      <ReportBreakdownTable
        title={reportsContent.players.heading}
        rowHeader={reportsContent.table.player}
        rows={playerBreakdownRows(report)}
      />,
    );
    const anna = screen.getByRole("row", { name: /Anna/ });
    expect(
      within(anna)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["1", "0", "0", "1", "2"]);
    expect(
      screen.getByRole("row", {
        name: new RegExp(reportsContent.players.unassigned),
      }),
    ).toBeInTheDocument();
  });

  it("shows the empty slot instead of a table without rows", () => {
    render(
      <ReportBreakdownTable
        title={reportsContent.quarters.heading}
        rowHeader={reportsContent.table.quarter}
        rows={[]}
        empty={<p>{reportsContent.quarters.notSet.title}</p>}
      />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByText(reportsContent.quarters.notSet.title),
    ).toBeInTheDocument();
  });
});
