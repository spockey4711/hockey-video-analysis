import { describe, expect, it } from "vitest";

import { parseQuartersInput } from "@/features/quarters/validation";

const gameId = "11111111-1111-4111-8111-111111111111";

function base(quarters: unknown): unknown {
  return { gameId, quarters };
}

describe("parseQuartersInput", () => {
  it("accepts a contiguous, ordered set and defaults an absent end to null", () => {
    const result = parseQuartersInput(
      base([
        { index: 1, startS: 0, endS: 600 },
        { index: 2, startS: 600 },
      ]),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        gameId,
        quarters: [
          { index: 1, startS: 0, endS: 600 },
          { index: 2, startS: 600, endS: null },
        ],
      },
    });
  });

  it("sorts quarters by index before validating", () => {
    const result = parseQuartersInput(
      base([
        { index: 2, startS: 600, endS: null },
        { index: 1, startS: 0, endS: 600 },
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.quarters.map((q) => q.index)).toEqual([1, 2]);
  });

  it("rejects a non-object body", () => {
    expect(parseQuartersInput(null).ok).toBe(false);
    expect(parseQuartersInput("nope").ok).toBe(false);
  });

  it("rejects a malformed game id", () => {
    expect(parseQuartersInput(base([{ index: 1, startS: 0 }])).ok).toBe(true);
    expect(
      parseQuartersInput({
        gameId: "nope",
        quarters: [{ index: 1, startS: 0 }],
      }).ok,
    ).toBe(false);
  });

  it("rejects a missing or empty quarters array", () => {
    expect(parseQuartersInput({ gameId }).ok).toBe(false);
    expect(parseQuartersInput(base([])).ok).toBe(false);
  });

  it("rejects more than four quarters", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      index: i + 1,
      startS: i * 100,
    }));
    expect(parseQuartersInput(base(five)).ok).toBe(false);
  });

  it("rejects an index outside 1..4", () => {
    expect(parseQuartersInput(base([{ index: 0, startS: 0 }])).ok).toBe(false);
    expect(parseQuartersInput(base([{ index: 5, startS: 0 }])).ok).toBe(false);
  });

  it("rejects a negative or non-numeric start", () => {
    expect(parseQuartersInput(base([{ index: 1, startS: -1 }])).ok).toBe(false);
    expect(parseQuartersInput(base([{ index: 1, startS: "0" }])).ok).toBe(
      false,
    );
  });

  it("rejects an end that is not after the start", () => {
    expect(
      parseQuartersInput(base([{ index: 1, startS: 100, endS: 100 }])).ok,
    ).toBe(false);
  });

  it("rejects a non-contiguous index run", () => {
    expect(
      parseQuartersInput(
        base([
          { index: 1, startS: 0 },
          { index: 3, startS: 600 },
        ]),
      ).ok,
    ).toBe(false);
  });

  it("rejects quarters whose starts are not strictly increasing", () => {
    expect(
      parseQuartersInput(
        base([
          { index: 1, startS: 600 },
          { index: 2, startS: 600 },
        ]),
      ).ok,
    ).toBe(false);
  });

  it("rejects overlapping quarters", () => {
    expect(
      parseQuartersInput(
        base([
          { index: 1, startS: 0, endS: 700 },
          { index: 2, startS: 600 },
        ]),
      ).ok,
    ).toBe(false);
  });
});
