import { describe, expect, it } from "vitest";

import { parseQuartersInput } from "@/features/quarters/validation";

const gameId = "11111111-1111-4111-8111-111111111111";

function base(quarters: unknown): unknown {
  return { gameId, quarters };
}

/** Parse for a game of four quarters, the default format. */
function parse(raw: unknown) {
  return parseQuartersInput(raw, 4);
}

describe("parseQuartersInput", () => {
  it("holds a game of two halves to two periods", () => {
    const halves = [
      { index: 1, startS: 60, endS: 1260 },
      { index: 2, startS: 1800 },
    ];
    expect(parseQuartersInput(base(halves), 2).ok).toBe(true);
    expect(
      parseQuartersInput(base([...halves, { index: 3, startS: 3100 }]), 2).ok,
    ).toBe(false);
    expect(parseQuartersInput(base([{ index: 3, startS: 60 }]), 2).ok).toBe(
      false,
    );
  });

  it("accepts a contiguous, ordered set and defaults an absent end to null", () => {
    const result = parse(
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
    const result = parse(
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
    expect(parse(null).ok).toBe(false);
    expect(parse("nope").ok).toBe(false);
  });

  it("rejects a malformed game id", () => {
    expect(parse(base([{ index: 1, startS: 0 }])).ok).toBe(true);
    expect(
      parse({
        gameId: "nope",
        quarters: [{ index: 1, startS: 0 }],
      }).ok,
    ).toBe(false);
  });

  it("rejects a missing or empty quarters array", () => {
    expect(parse({ gameId }).ok).toBe(false);
    expect(parse(base([])).ok).toBe(false);
  });

  it("rejects more than four quarters", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      index: i + 1,
      startS: i * 100,
    }));
    expect(parse(base(five)).ok).toBe(false);
  });

  it("rejects an index outside 1..4", () => {
    expect(parse(base([{ index: 0, startS: 0 }])).ok).toBe(false);
    expect(parse(base([{ index: 5, startS: 0 }])).ok).toBe(false);
  });

  it("rejects a negative or non-numeric start", () => {
    expect(parse(base([{ index: 1, startS: -1 }])).ok).toBe(false);
    expect(parse(base([{ index: 1, startS: "0" }])).ok).toBe(false);
  });

  it("rejects an end that is not after the start", () => {
    expect(parse(base([{ index: 1, startS: 100, endS: 100 }])).ok).toBe(false);
  });

  it("rejects a non-contiguous index run", () => {
    expect(
      parse(
        base([
          { index: 1, startS: 0 },
          { index: 3, startS: 600 },
        ]),
      ).ok,
    ).toBe(false);
  });

  it("rejects quarters whose starts are not strictly increasing", () => {
    expect(
      parse(
        base([
          { index: 1, startS: 600 },
          { index: 2, startS: 600 },
        ]),
      ).ok,
    ).toBe(false);
  });

  it("rejects overlapping quarters", () => {
    expect(
      parse(
        base([
          { index: 1, startS: 0, endS: 700 },
          { index: 2, startS: 600 },
        ]),
      ).ok,
    ).toBe(false);
  });
});
