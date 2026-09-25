import { describe, expect, it } from "vitest";

import {
  clampIndex,
  indexAfterEnd,
  isLast,
  nextIndex,
  playsOnSelect,
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

describe("playsOnSelect", () => {
  it("starts a selected clip only in continuous mode", () => {
    expect(playsOnSelect("continuous")).toBe(true);
    expect(playsOnSelect("manual")).toBe(false);
  });
});

describe("indexAfterEnd", () => {
  it("advances in continuous mode and stops on the last clip", () => {
    expect(indexAfterEnd("continuous", 0, 3)).toBe(1);
    expect(indexAfterEnd("continuous", 2, 3)).toBeNull();
  });

  it("never advances in manual mode", () => {
    expect(indexAfterEnd("manual", 0, 3)).toBeNull();
    expect(indexAfterEnd("manual", 2, 3)).toBeNull();
  });
});
