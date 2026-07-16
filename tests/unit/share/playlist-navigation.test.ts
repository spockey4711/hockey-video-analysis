import { describe, expect, it } from "vitest";

import {
  clampIndex,
  isLast,
  nextIndex,
  prevIndex,
} from "@/features/share/playlist/playlist-navigation";

describe("clampIndex", () => {
  it("keeps an in-range index", () => {
    expect(clampIndex(1, 3)).toBe(1);
  });

  it("clamps below zero and above the last index", () => {
    expect(clampIndex(-2, 3)).toBe(0);
    expect(clampIndex(9, 3)).toBe(2);
  });

  it("clamps to 0 for an empty list", () => {
    expect(clampIndex(4, 0)).toBe(0);
  });
});

describe("nextIndex / prevIndex", () => {
  it("advances and retreats within range", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(prevIndex(2, 3)).toBe(1);
  });

  it("stops at the ends (no wrap-around)", () => {
    expect(nextIndex(2, 3)).toBe(2);
    expect(prevIndex(0, 3)).toBe(0);
  });
});

describe("isLast", () => {
  it("is true only on the final item", () => {
    expect(isLast(2, 3)).toBe(true);
    expect(isLast(1, 3)).toBe(false);
  });
});
