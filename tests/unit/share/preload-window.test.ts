import { describe, expect, it } from "vitest";

import {
  PRELOAD_AHEAD,
  preloadWindow,
} from "@/features/share/playlist/preload-window";

describe("preloadWindow", () => {
  it("loads the next two clips ahead in full", () => {
    expect(PRELOAD_AHEAD).toBe(2);
    expect(preloadWindow(0, 5, false)).toEqual({
      indices: [1, 2],
      preload: "auto",
    });
    expect(preloadWindow(2, 5, false).indices).toEqual([3, 4]);
  });

  it("stops at the last clip and loads nothing ahead of it", () => {
    expect(preloadWindow(3, 5, false).indices).toEqual([4]);
    expect(preloadWindow(4, 5, false).indices).toEqual([]);
  });

  it("never loads the current clip or one behind it", () => {
    for (let current = 0; current < 6; current += 1) {
      for (const index of preloadWindow(current, 6, false).indices) {
        expect(index).toBeGreaterThan(current);
      }
    }
  });

  it("loads only metadata when the viewer saves data", () => {
    expect(preloadWindow(0, 5, true)).toEqual({
      indices: [1, 2],
      preload: "metadata",
    });
  });

  it("loads nothing for an empty or single-clip list", () => {
    expect(preloadWindow(0, 0, false).indices).toEqual([]);
    expect(preloadWindow(0, 1, false).indices).toEqual([]);
  });

  it("clamps an out-of-range current clip into the list", () => {
    expect(preloadWindow(-1, 3, false).indices).toEqual([1, 2]);
    expect(preloadWindow(9, 3, false).indices).toEqual([]);
  });
});
