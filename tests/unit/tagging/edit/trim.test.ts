import { describe, expect, it } from "vitest";

import {
  effectiveEnd,
  isValidWindow,
  nudgeEdge,
} from "@/features/tagging/edit/trim";

const window = { type: "goal", startS: 100, endS: 115 };

describe("effectiveEnd", () => {
  it("is the explicit end when there is one", () => {
    expect(effectiveEnd(window)).toBe(115);
  });

  it("falls back to the type's follow-through after the start", () => {
    // `goal` is configured with postS = 5.
    expect(effectiveEnd({ ...window, endS: null })).toBe(105);
  });
});

describe("nudgeEdge", () => {
  it("moves the start earlier and later", () => {
    expect(nudgeEdge(window, "start", -1, 3600).startS).toBe(99);
    expect(nudgeEdge(window, "start", 1, 3600).startS).toBe(101);
  });

  it("moves the end without touching the start", () => {
    expect(nudgeEdge(window, "end", 1, 3600)).toEqual({
      ...window,
      endS: 116,
    });
  });

  it("makes a default end explicit, starting from its effective value", () => {
    expect(nudgeEdge({ ...window, endS: null }, "end", 1, 3600).endS).toBe(106);
  });

  it("clamps to the start and the end of the game", () => {
    expect(
      nudgeEdge({ ...window, startS: 0.4 }, "start", -1, 3600).startS,
    ).toBe(0);
    expect(nudgeEdge(window, "end", 1, 115.5).endS).toBe(115.5);
  });
});

describe("isValidWindow", () => {
  it("accepts an end after the start, including the default window", () => {
    expect(isValidWindow(window)).toBe(true);
    expect(isValidWindow({ ...window, endS: null })).toBe(true);
  });

  it("rejects an empty or inverted window", () => {
    expect(isValidWindow({ ...window, endS: 100 })).toBe(false);
    expect(isValidWindow({ ...window, startS: 120 })).toBe(false);
  });
});
