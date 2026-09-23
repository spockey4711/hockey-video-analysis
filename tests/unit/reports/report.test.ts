import { describe, expect, it } from "vitest";

import {
  buildGameReport,
  type ReportPlayer,
  type ReportTag,
} from "@/features/reports/report";

function tag(
  id: string,
  type: string,
  startS: number,
  playerIds: string[] = [],
): ReportTag {
  return { id, type, startS, playerIds };
}

const anna: ReportPlayer = { id: "p-anna", name: "Anna", jerseyNumber: 7 };
const ben: ReportPlayer = { id: "p-ben", name: "Ben", jerseyNumber: 3 };
const carla: ReportPlayer = {
  id: "p-carla",
  name: "Carla",
  jerseyNumber: null,
};

describe("buildGameReport", () => {
  it("counts every configured tag type and the total", () => {
    const report = buildGameReport({
      tags: [
        tag("t1", "goal", 10),
        tag("t2", "goal", 20),
        tag("t3", "corner_short", 30),
        tag("t4", "action_good", 40),
        tag("t5", "action_bad", 50),
        tag("t6", "action_bad", 60),
      ],
      players: [],
      quarters: [],
    });

    expect(report.totals).toEqual({
      counts: { goal: 2, corner_short: 1, action_good: 1, action_bad: 2 },
      total: 6,
    });
  });

  it("returns zeroed figures for a game without tags", () => {
    const report = buildGameReport({ tags: [], players: [], quarters: [] });
    expect(report.totals.total).toBe(0);
    expect(report.totals.counts).toEqual({
      goal: 0,
      corner_short: 0,
      action_good: 0,
      action_bad: 0,
    });
    expect(report.players).toEqual([]);
    expect(report.unassigned.total).toBe(0);
  });

  it("skips tags whose type is no longer configured", () => {
    const report = buildGameReport({
      tags: [tag("t1", "goal", 10), tag("t2", "retired_type", 20, ["p-anna"])],
      players: [anna],
      quarters: [],
    });
    expect(report.totals.total).toBe(1);
    expect(report.players).toEqual([]);
  });

  describe("quarter breakdown", () => {
    it("is null when no quarters are marked", () => {
      const report = buildGameReport({
        tags: [tag("t1", "goal", 10)],
        players: [],
        quarters: [],
      });
      expect(report.quarters).toBeNull();
    });

    it("buckets tags into their quarter and counts the rest as outside", () => {
      const report = buildGameReport({
        tags: [
          tag("t0", "action_good", 5), // before the first quarter
          tag("t1", "goal", 100),
          tag("t2", "corner_short", 950), // in the break after quarter 1
          tag("t3", "goal", 1000), // exactly on the Q2 start: belongs to Q2
          tag("t4", "action_bad", 5000), // open-ended last quarter
        ],
        players: [],
        quarters: [
          { index: 2, startS: 1000, endS: null },
          { index: 1, startS: 60, endS: 960 - 20 },
        ],
      });

      expect(report.quarters?.rows.map((row) => row.index)).toEqual([1, 2]);
      expect(report.quarters?.rows[0].figures).toEqual({
        counts: { goal: 1, corner_short: 0, action_good: 0, action_bad: 0 },
        total: 1,
      });
      expect(report.quarters?.rows[1].figures).toEqual({
        counts: { goal: 1, corner_short: 0, action_good: 0, action_bad: 1 },
        total: 2,
      });
      expect(report.quarters?.outside).toEqual({
        counts: { goal: 0, corner_short: 1, action_good: 1, action_bad: 0 },
        total: 2,
      });
    });

    it("keeps a marked quarter without tags as a zero row", () => {
      const report = buildGameReport({
        tags: [tag("t1", "goal", 100)],
        players: [],
        quarters: [
          { index: 1, startS: 0, endS: 900 },
          { index: 2, startS: 1000, endS: 1900 },
        ],
      });
      expect(report.quarters?.rows[1]).toEqual({
        index: 2,
        figures: {
          counts: { goal: 0, corner_short: 0, action_good: 0, action_bad: 0 },
          total: 0,
        },
      });
      expect(report.quarters?.outside.total).toBe(0);
    });
  });

  describe("player breakdown", () => {
    it("credits a tag to every linked player and counts unlinked tags apart", () => {
      const report = buildGameReport({
        tags: [
          tag("t1", "goal", 10, ["p-anna", "p-ben"]),
          tag("t2", "action_good", 20, ["p-anna"]),
          tag("t3", "action_bad", 30),
          tag("t4", "corner_short", 40),
        ],
        players: [anna, ben, carla],
        quarters: [],
      });

      expect(report.players).toEqual([
        {
          player: ben,
          figures: {
            counts: {
              goal: 1,
              corner_short: 0,
              action_good: 0,
              action_bad: 0,
            },
            total: 1,
          },
        },
        {
          player: anna,
          figures: {
            counts: {
              goal: 1,
              corner_short: 0,
              action_good: 1,
              action_bad: 0,
            },
            total: 2,
          },
        },
      ]);
      expect(report.unassigned).toEqual({
        counts: { goal: 0, corner_short: 1, action_good: 0, action_bad: 1 },
        total: 2,
      });
    });

    it("orders players like the roster: numbered first ascending, then by name", () => {
      const dora: ReportPlayer = {
        id: "p-dora",
        name: "Dora",
        jerseyNumber: null,
      };
      const report = buildGameReport({
        tags: [tag("t1", "goal", 10, ["p-dora", "p-carla", "p-anna", "p-ben"])],
        players: [dora, carla, anna, ben],
        quarters: [],
      });
      expect(report.players.map((row) => row.player.name)).toEqual([
        "Ben",
        "Anna",
        "Carla",
        "Dora",
      ]);
    });

    it("counts a duplicated link once and ignores links to unknown players", () => {
      const report = buildGameReport({
        tags: [tag("t1", "goal", 10, ["p-anna", "p-anna", "p-ghost"])],
        players: [anna],
        quarters: [],
      });
      expect(report.players).toHaveLength(1);
      expect(report.players[0].figures.total).toBe(1);
      expect(report.unassigned.total).toBe(0);
    });
  });
});
