import { describe, expect, it } from "vitest";

import {
  clampGameTimeS,
  nextChapterIndex,
  planSeek,
} from "@/features/player/playback-plan";

// Three chapters, cumulative starts 0 / 100 / 250, total 400 - the same layout
// the time-mapping contract tests pin, so boundary behaviour lines up.
const durations = [100, 150, 150];

describe("clampGameTimeS", () => {
  it("passes an in-range time through untouched", () => {
    expect(clampGameTimeS(durations, 120)).toBe(120);
  });

  it("saturates below zero and above the total", () => {
    expect(clampGameTimeS(durations, -5)).toBe(0);
    expect(clampGameTimeS(durations, 999)).toBe(400);
  });

  it("treats non-finite input as the start", () => {
    expect(clampGameTimeS(durations, Number.NaN)).toBe(0);
  });
});

describe("planSeek", () => {
  it("stays in the active chapter without a source switch", () => {
    expect(planSeek(durations, 0, 40)).toEqual({
      sourceIndex: 0,
      localOffsetS: 40,
      switchSource: false,
    });
  });

  it("flags a source switch when the target lands in another chapter", () => {
    expect(planSeek(durations, 0, 300)).toEqual({
      sourceIndex: 2,
      localOffsetS: 50,
      switchSource: true,
    });
  });

  it("maps an interior boundary to the start of the next chapter", () => {
    expect(planSeek(durations, 0, 100)).toEqual({
      sourceIndex: 1,
      localOffsetS: 0,
      switchSource: true,
    });
  });

  it("does not switch when the resolved chapter is already active", () => {
    expect(planSeek(durations, 1, 120)).toEqual({
      sourceIndex: 1,
      localOffsetS: 20,
      switchSource: false,
    });
  });

  it("clamps an out-of-range seek before mapping it", () => {
    expect(planSeek(durations, 0, 999)).toEqual({
      sourceIndex: 2,
      localOffsetS: 150,
      switchSource: true,
    });
    expect(planSeek(durations, 2, -5)).toEqual({
      sourceIndex: 0,
      localOffsetS: 0,
      switchSource: true,
    });
  });
});

describe("nextChapterIndex", () => {
  it("advances to the following chapter", () => {
    expect(nextChapterIndex(3, 0)).toBe(1);
    expect(nextChapterIndex(3, 1)).toBe(2);
  });

  it("returns null after the last chapter (game over)", () => {
    expect(nextChapterIndex(3, 2)).toBeNull();
    expect(nextChapterIndex(1, 0)).toBeNull();
  });
});
