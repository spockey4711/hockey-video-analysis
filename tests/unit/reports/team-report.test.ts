import { describe, expect, it } from "vitest";

import { buildTeamReport } from "@/features/reports/team-report";

const anna = { id: "p1", name: "Anna", jerseyNumber: 7 };
const bea = { id: "p2", name: "Bea", jerseyNumber: 3 };
const carla = { id: "p3", name: "Carla", jerseyNumber: null };

const derby = {
  id: "g1",
  title: "Derby",
  opponent: "Blau",
  playedOn: "2026-05-12",
};
const cup = { id: "g2", title: "Pokal", opponent: null, playedOn: null };

describe("buildTeamReport", () => {
  it("sums the per-game figures per game, per player and in total", () => {
    const report = buildTeamReport({
      games: [derby, cup],
      tags: [
        { id: "t1", gameId: "g1", type: "goal", startS: 10, playerIds: ["p1"] },
        {
          id: "t2",
          gameId: "g1",
          type: "action_good",
          startS: 20,
          playerIds: ["p1", "p2"],
        },
        { id: "t3", gameId: "g2", type: "goal", startS: 5, playerIds: ["p1"] },
        {
          id: "t4",
          gameId: "g2",
          type: "corner_short",
          startS: 8,
          playerIds: [],
        },
      ],
      players: [anna, bea],
    });

    expect(report.totals).toEqual({
      counts: { goal: 2, corner_short: 1, action_good: 1, action_bad: 0 },
      total: 4,
    });
    expect(report.games.map((row) => [row.game.id, row.figures.total])).toEqual(
      [
        ["g1", 2],
        ["g2", 2],
      ],
    );
    expect(
      report.players.map((row) => [
        row.player.name,
        row.figures.counts.goal,
        row.figures.total,
      ]),
    ).toEqual([
      ["Bea", 0, 1],
      ["Anna", 2, 3],
    ]);
    expect(report.unassigned.total).toBe(1);
  });

  it("keeps games without tags and the given game order", () => {
    const report = buildTeamReport({
      games: [cup, derby],
      tags: [],
      players: [],
    });
    expect(report.games.map((row) => [row.game.id, row.figures.total])).toEqual(
      [
        ["g2", 0],
        ["g1", 0],
      ],
    );
    expect(report.totals.total).toBe(0);
    expect(report.players).toEqual([]);
  });

  it("ignores tags of games outside the report and unknown tag types", () => {
    const report = buildTeamReport({
      games: [derby],
      tags: [
        { id: "t1", gameId: "g9", type: "goal", startS: 1, playerIds: ["p1"] },
        { id: "t2", gameId: "g1", type: "retired", startS: 1, playerIds: [] },
      ],
      players: [anna],
    });
    expect(report.totals.total).toBe(0);
    expect(report.players).toEqual([]);
  });

  it("lists players in roster order, unnumbered players last", () => {
    const report = buildTeamReport({
      games: [derby],
      tags: [
        {
          id: "t1",
          gameId: "g1",
          type: "goal",
          startS: 1,
          playerIds: ["p3", "p1", "p2"],
        },
      ],
      players: [carla, anna, bea],
    });
    expect(report.players.map((row) => row.player.name)).toEqual([
      "Bea",
      "Anna",
      "Carla",
    ]);
  });
});
