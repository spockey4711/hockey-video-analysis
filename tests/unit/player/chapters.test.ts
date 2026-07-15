import { describe, expect, it } from "vitest";

import { chapterLanes } from "@/features/player/chapters";

describe("chapterLanes", () => {
  it("places each chapter as a fraction of the total game length", () => {
    // Two chapters of 100s and 300s: total 400s, so lanes span 25% and 75%.
    expect(chapterLanes([100, 300])).toEqual([
      { label: "V1", startFraction: 0, widthFraction: 0.25 },
      { label: "V2", startFraction: 0.25, widthFraction: 0.75 },
    ]);
  });

  it("labels lanes 1-based in source order", () => {
    expect(
      chapterLanes([1, 1, 1, 1].map(() => 60)).map((l) => l.label),
    ).toEqual(["V1", "V2", "V3", "V4"]);
  });

  it("returns nothing when the total length is not positive", () => {
    expect(chapterLanes([])).toEqual([]);
    expect(chapterLanes([0, 0])).toEqual([]);
  });

  it("ignores non-finite or negative durations in the total", () => {
    // Only the 200s chapter counts; the bad one contributes zero width.
    const lanes = chapterLanes([200, Number.NaN]);
    expect(lanes[0]).toEqual({
      label: "V1",
      startFraction: 0,
      widthFraction: 1,
    });
    expect(lanes[1].widthFraction).toBe(0);
  });
});
