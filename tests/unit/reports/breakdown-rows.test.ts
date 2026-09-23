import { describe, expect, it } from "vitest";

import {
  playerBreakdownRows,
  quarterBreakdownRows,
} from "@/features/reports/breakdown-rows";
import { buildGameReport } from "@/features/reports/report";

const report = buildGameReport({
  tags: [
    { id: "t1", type: "goal", startS: 100, playerIds: ["p1"] },
    { id: "t2", type: "action_bad", startS: 5, playerIds: [] },
    { id: "t3", type: "action_good", startS: 200, playerIds: ["p2"] },
  ],
  players: [
    { id: "p1", name: "Anna", jerseyNumber: 7 },
    { id: "p2", name: "Carla", jerseyNumber: null },
  ],
  quarters: [{ index: 1, startS: 60, endS: null }],
});

describe("quarterBreakdownRows", () => {
  it("labels each quarter and appends the outside row when it holds tags", () => {
    const rows = quarterBreakdownRows(report);
    expect(
      rows?.map((row) => [row.label, row.figures.total, row.isRemainder]),
    ).toEqual([
      ["1. Viertel", 2, false],
      ["Außerhalb der Viertel", 1, true],
    ]);
  });

  it("is null without marked quarters", () => {
    expect(
      quarterBreakdownRows(
        buildGameReport({ tags: [], players: [], quarters: [] }),
      ),
    ).toBeNull();
  });

  it("leaves out an empty outside row", () => {
    const inside = buildGameReport({
      tags: [{ id: "t1", type: "goal", startS: 100, playerIds: [] }],
      players: [],
      quarters: [{ index: 1, startS: 0, endS: null }],
    });
    expect(quarterBreakdownRows(inside)?.map((row) => row.key)).toEqual([
      "quarter-1",
    ]);
  });
});

describe("playerBreakdownRows", () => {
  it("prefixes numbered players and ends with the unassigned row", () => {
    expect(
      playerBreakdownRows(report).map((row) => [
        row.prefix,
        row.label,
        row.figures.total,
        row.isRemainder,
      ]),
    ).toEqual([
      ["#7", "Anna", 1, false],
      [null, "Carla", 1, false],
      [null, "Ohne Spieler", 1, true],
    ]);
  });

  it("leaves out the unassigned row when every tag names a player", () => {
    const allLinked = buildGameReport({
      tags: [{ id: "t1", type: "goal", startS: 1, playerIds: ["p1"] }],
      players: [{ id: "p1", name: "Anna", jerseyNumber: 7 }],
      quarters: [],
    });
    expect(playerBreakdownRows(allLinked).map((row) => row.label)).toEqual([
      "Anna",
    ]);
  });
});
