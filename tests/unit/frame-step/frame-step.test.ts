import { describe, expect, it } from "vitest";

import {
  DEFAULT_FRAME_RATE,
  frameDurationS,
  frameRateAt,
  usableFrameRate,
} from "@/lib/frame-step";

describe("usableFrameRate", () => {
  it.each([25, 50, 60000 / 1001, 240])("keeps %s fps", (rate) => {
    expect(usableFrameRate(rate)).toBe(rate);
  });

  it.each([0, -25, 241, Number.NaN, Number.POSITIVE_INFINITY, "50", null])(
    "rejects %s",
    (value) => {
      expect(usableFrameRate(value)).toBeNull();
    },
  );
});

describe("frameDurationS", () => {
  it("is one frame of the given rate", () => {
    expect(frameDurationS(50)).toBe(1 / 50);
    expect(frameDurationS(25)).toBe(1 / 25);
  });

  it("falls back to the default rate when the rate is unknown or unusable", () => {
    expect(DEFAULT_FRAME_RATE).toBe(25);
    for (const rate of [null, undefined, 0, -1, Number.NaN]) {
      expect(frameDurationS(rate)).toBe(1 / 25);
    }
  });
});

describe("frameRateAt", () => {
  const chapters = [
    { durationS: 100, frameRate: 50 },
    { durationS: 50, frameRate: null },
    { durationS: 100, frameRate: 25 },
  ];

  it("is the rate of the chapter playing at the game time", () => {
    expect(frameRateAt(chapters, 0)).toBe(50);
    expect(frameRateAt(chapters, 99.99)).toBe(50);
    expect(frameRateAt(chapters, 200)).toBe(25);
  });

  it("follows the game-time mapping at a seam: the next chapter starts there", () => {
    expect(frameRateAt(chapters, 150)).toBe(25);
  });

  it("is null inside a chapter without a recorded rate", () => {
    expect(frameRateAt(chapters, 120)).toBeNull();
  });

  it("clamps a time outside the game onto its first or last chapter", () => {
    expect(frameRateAt(chapters, -3)).toBe(50);
    expect(frameRateAt(chapters, 9999)).toBe(25);
  });

  it("is null for a game without chapters", () => {
    expect(frameRateAt([], 10)).toBeNull();
  });
});
