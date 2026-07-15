import { describe, expect, it } from "vitest";

import {
  quarterAt,
  quarterBands,
  quarterWindow,
  type Quarter,
} from "@/features/quarters/navigation";

// Four contiguous quarters with a short break before the last one, so the gap
// case is exercised. Q4 is open-ended (no explicit end).
const quarters: Quarter[] = [
  { index: 1, startS: 0, endS: 600 },
  { index: 2, startS: 600, endS: 1200 },
  { index: 3, startS: 1200, endS: 1800 },
  { index: 4, startS: 1900, endS: null },
];

describe("quarterAt", () => {
  it("returns the quarter containing the offset", () => {
    expect(quarterAt(quarters, 300)?.index).toBe(1);
    expect(quarterAt(quarters, 900)?.index).toBe(2);
    expect(quarterAt(quarters, 1250)?.index).toBe(3);
  });

  it("treats the interval as half-open, so a boundary belongs to the next span", () => {
    expect(quarterAt(quarters, 600)?.index).toBe(2);
    expect(quarterAt(quarters, 1200)?.index).toBe(3);
  });

  it("returns null in a break between quarters", () => {
    expect(quarterAt(quarters, 1850)).toBeNull();
  });

  it("returns null before the first quarter starts", () => {
    const later: Quarter[] = [{ index: 1, startS: 100, endS: 200 }];
    expect(quarterAt(later, 50)).toBeNull();
  });

  it("matches every offset after an open-ended final quarter", () => {
    expect(quarterAt(quarters, 1900)?.index).toBe(4);
    expect(quarterAt(quarters, 100_000)?.index).toBe(4);
  });

  it("sorts arbitrary input order before matching", () => {
    const shuffled = [...quarters].reverse();
    expect(quarterAt(shuffled, 900)?.index).toBe(2);
  });

  it("returns null for a non-finite offset", () => {
    expect(quarterAt(quarters, Number.NaN)).toBeNull();
  });
});

describe("quarterWindow", () => {
  it("uses the explicit end when set", () => {
    expect(quarterWindow(quarters, 2, 3600)).toEqual({
      startS: 600,
      endS: 1200,
    });
  });

  it("falls back to the next quarter's start when the end is absent", () => {
    const open: Quarter[] = [
      { index: 1, startS: 0, endS: null },
      { index: 2, startS: 600, endS: null },
    ];
    expect(quarterWindow(open, 1, 3600)).toEqual({ startS: 0, endS: 600 });
  });

  it("falls back to the game end for an open-ended final quarter", () => {
    expect(quarterWindow(quarters, 4, 3600)).toEqual({
      startS: 1900,
      endS: 3600,
    });
  });

  it("clamps an out-of-range boundary to the game length", () => {
    const over: Quarter[] = [{ index: 1, startS: 0, endS: 9999 }];
    expect(quarterWindow(over, 1, 3600)).toEqual({ startS: 0, endS: 3600 });
  });

  it("returns null when no quarter has that index", () => {
    expect(quarterWindow(quarters, 9, 3600)).toBeNull();
  });
});

describe("quarterBands", () => {
  it("maps each quarter to clamped start/end fractions of the game", () => {
    const bands = quarterBands(
      [
        { index: 1, startS: 0, endS: 1800 },
        { index: 2, startS: 1800, endS: 3600 },
      ],
      3600,
    );
    expect(bands).toEqual([
      { index: 1, startFraction: 0, endFraction: 0.5 },
      { index: 2, startFraction: 0.5, endFraction: 1 },
    ]);
  });

  it("clamps fractions past the game end to 1", () => {
    const bands = quarterBands([{ index: 1, startS: 0, endS: 7200 }], 3600);
    expect(bands[0].endFraction).toBe(1);
  });

  it("returns no bands when the total duration is not positive", () => {
    expect(quarterBands(quarters, 0)).toEqual([]);
  });
});
