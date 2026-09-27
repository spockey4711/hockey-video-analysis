import { describe, expect, it } from "vitest";

import { quarterClockS } from "@/features/quarters/clock";
import type { Quarter } from "@/features/quarters/navigation";

// A game whose four quarters were marked at uneven offsets in the footage: the
// clock must ignore those gaps and read the nominal quarter time instead.
const QUARTER_LENGTH_S = 15 * 60;

const quarters: readonly Quarter[] = [
  { index: 1, startS: 60, endS: 900 },
  { index: 2, startS: 1000, endS: 2000 },
  { index: 3, startS: 2100, endS: 3000 },
  { index: 4, startS: 3200, endS: null },
];

describe("quarterClockS", () => {
  it("starts the clock at 0:00 when the first quarter begins", () => {
    expect(quarterClockS(quarters, 60, QUARTER_LENGTH_S)).toBe(0);
    // 30s into the first quarter reads 0:30, not the raw 90s offset.
    expect(quarterClockS(quarters, 90, QUARTER_LENGTH_S)).toBe(30);
  });

  it("reads exactly 15:00 at the second quarter and runs on from there", () => {
    expect(quarterClockS(quarters, 1000, QUARTER_LENGTH_S)).toBe(
      QUARTER_LENGTH_S,
    );
    expect(quarterClockS(quarters, 1030, QUARTER_LENGTH_S)).toBe(
      QUARTER_LENGTH_S + 30,
    );
  });

  it("reads 30:00 and 45:00 at the third and fourth quarters", () => {
    expect(quarterClockS(quarters, 2100, QUARTER_LENGTH_S)).toBe(
      2 * QUARTER_LENGTH_S,
    );
    expect(quarterClockS(quarters, 3200, QUARTER_LENGTH_S)).toBe(
      3 * QUARTER_LENGTH_S,
    );
  });

  it("runs the raw game time outside any quarter", () => {
    // Before the first quarter is reached, and in the break after quarter one.
    expect(quarterClockS(quarters, 30, QUARTER_LENGTH_S)).toBe(30);
    expect(quarterClockS(quarters, 950, QUARTER_LENGTH_S)).toBe(950);
  });

  it("returns the raw offset when no quarters are set", () => {
    expect(quarterClockS([], 123, QUARTER_LENGTH_S)).toBe(123);
  });

  it("reads a 2 x 20 game in halves", () => {
    const halves: readonly Quarter[] = [
      { index: 1, startS: 90, endS: 1290 },
      { index: 2, startS: 1800, endS: null },
    ];
    expect(quarterClockS(halves, 90, 1200)).toBe(0);
    // Half-time break runs raw, then the second half starts at 20:00.
    expect(quarterClockS(halves, 1500, 1200)).toBe(1500);
    expect(quarterClockS(halves, 1800, 1200)).toBe(1200);
    expect(quarterClockS(halves, 2400, 1200)).toBe(1800);
  });

  it("counts in the given quarter length", () => {
    // Ten-minute quarters: the third quarter starts at 20:00 on the clock.
    expect(quarterClockS(quarters, 2100, 600)).toBe(1200);
    expect(quarterClockS(quarters, 2130, 600)).toBe(1230);
    // Outside a quarter the length does not matter.
    expect(quarterClockS(quarters, 950, 600)).toBe(950);
  });
});
