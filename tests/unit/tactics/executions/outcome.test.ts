import { describe, expect, it } from "vitest";

import {
  compareExecutions,
  defaultOutcome,
  executionStats,
  NO_EXECUTIONS,
  parseExecutionOutcome,
  successRate,
  type ExecutionPlace,
} from "@/features/tactics/executions/outcome";

describe("parseExecutionOutcome", () => {
  it("reads the three outcomes and nothing else", () => {
    expect(parseExecutionOutcome("success")).toBe("success");
    expect(parseExecutionOutcome("failure")).toBe("failure");
    expect(parseExecutionOutcome("open")).toBe("open");
    for (const value of ["", "Success", "won", null, 1, undefined]) {
      expect(parseExecutionOutcome(value)).toBeNull();
    }
  });
});

describe("executionStats and successRate", () => {
  it("counts the executions by outcome", () => {
    expect(
      executionStats(["success", "open", "failure", "success", "success"]),
    ).toEqual({ total: 5, success: 3, failure: 1, open: 1 });
    expect(executionStats([])).toEqual(NO_EXECUTIONS);
  });

  it("rates only the rated executions, as a whole percent", () => {
    expect(
      successRate(executionStats(["success", "success", "failure", "open"])),
    ).toBe(67);
    expect(successRate(executionStats(["failure"]))).toBe(0);
    expect(successRate(executionStats(["success"]))).toBe(100);
  });

  it("has no rate while nothing is rated", () => {
    expect(successRate(NO_EXECUTIONS)).toBeNull();
    expect(successRate(executionStats(["open", "open"]))).toBeNull();
  });
});

describe("defaultOutcome", () => {
  const corner = { startS: 600, endS: 614 };

  it("is a success when a goal is tagged inside the corner's window", () => {
    expect(defaultOutcome(corner, [{ startS: 604, endS: 619 }])).toBe(
      "success",
    );
    // A goal window that starts before the corner but reaches into it.
    expect(defaultOutcome(corner, [{ startS: 590, endS: 601 }])).toBe(
      "success",
    );
  });

  it("stays open without a goal in the window, never a failure", () => {
    expect(defaultOutcome(corner, [])).toBe("open");
    expect(defaultOutcome(corner, [{ startS: 614, endS: 629 }])).toBe("open");
    expect(defaultOutcome(corner, [{ startS: 100, endS: 115 }])).toBe("open");
  });

  it("counts a goal tag linked as its own execution", () => {
    const goal = { startS: 300, endS: 315 };
    expect(defaultOutcome(goal, [goal])).toBe("success");
  });
});

describe("compareExecutions", () => {
  const place = (
    tagId: string,
    playedOn: string | null,
    gameId: string,
    startS: number,
  ): ExecutionPlace => ({ tagId, playedOn, gameId, startS });

  it("plays the newest game first, then by game time", () => {
    const rows = [
      place("a", "2026-04-01", "g1", 900),
      place("b", "2026-05-10", "g2", 1200),
      place("c", "2026-04-01", "g1", 120),
      place("d", "2026-05-10", "g2", 60),
    ];
    expect(rows.sort(compareExecutions).map((row) => row.tagId)).toEqual([
      "d",
      "b",
      "c",
      "a",
    ]);
  });

  it("puts undated games last and keeps each game together", () => {
    const rows = [
      place("a", null, "g9", 10),
      place("b", "2026-05-10", "g3", 500),
      place("c", "2026-05-10", "g2", 900),
      place("d", "2026-05-10", "g3", 100),
      place("e", "2026-05-10", "g2", 50),
    ];
    expect(rows.sort(compareExecutions).map((row) => row.tagId)).toEqual([
      "e",
      "c",
      "d",
      "b",
      "a",
    ]);
  });

  it("breaks a full tie on the tag id, whatever order the rows came in", () => {
    const x = place("x", "2026-05-10", "g1", 100);
    const y = place("y", "2026-05-10", "g1", 100);
    expect([y, x].sort(compareExecutions)).toEqual([x, y]);
    expect([x, y].sort(compareExecutions)).toEqual([x, y]);
  });
});
