import { describe, expect, it } from "vitest";

import { QUARTER_LENGTH_S, quarterClockS } from "@/features/quarters/clock";
import type { Quarter } from "@/features/quarters/navigation";

// A game whose four quarters were marked at uneven offsets in the footage: the
// clock must ignore those gaps and read the nominal quarter time instead.
const quarters: readonly Quarter[] = [
  { index: 1, startS: 60, endS: 900 },
  { index: 2, startS: 1000, endS: 2000 },
  { index: 3, startS: 2100, endS: 3000 },
  { index: 4, startS: 3200, endS: null },
];

describe("quarterClockS", () => {
  it("starts the clock at 0:00 when the first quarter begins", () => {
    expect(quarterClockS(quarters, 60)).toBe(0);
    // 30s into the first quarter reads 0:30, not the raw 90s offset.
    expect(quarterClockS(quarters, 90)).toBe(30);
  });

  it("reads exactly 15:00 at the second quarter and runs on from there", () => {
    expect(quarterClockS(quarters, 1000)).toBe(QUARTER_LENGTH_S);
    expect(quarterClockS(quarters, 1030)).toBe(QUARTER_LENGTH_S + 30);
  });

  it("reads 30:00 and 45:00 at the third and fourth quarters", () => {
    expect(quarterClockS(quarters, 2100)).toBe(2 * QUARTER_LENGTH_S);
    expect(quarterClockS(quarters, 3200)).toBe(3 * QUARTER_LENGTH_S);
  });

  it("runs the raw game time outside any quarter", () => {
    // Before the first quarter is reached, and in the break after quarter one.
    expect(quarterClockS(quarters, 30)).toBe(30);
    expect(quarterClockS(quarters, 950)).toBe(950);
  });

  it("returns the raw offset when no quarters are set", () => {
    expect(quarterClockS([], 123)).toBe(123);
  });
});
