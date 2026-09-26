import { describe, expect, it } from "vitest";

import {
  effectiveEnd,
  isValidWindow,
  nudgeEdge,
} from "@/features/tagging/edit/trim";
import { DEFAULT_TAG_WINDOWS, resolveTagWindows } from "@/lib/tag-types";

const defaults = DEFAULT_TAG_WINDOWS;
const window = { type: "goal", startS: 100, endS: 115 };

describe("effectiveEnd", () => {
  it("is the explicit end when there is one", () => {
    expect(effectiveEnd(window, defaults)).toBe(115);
  });

  it("falls back to the type's follow-through after the start", () => {
    // `goal` is configured with postS = 5.
    expect(effectiveEnd({ ...window, endS: null }, defaults)).toBe(105);
  });

  it("falls back to the team's follow-through when the team set one", () => {
    const team = resolveTagWindows([{ type: "goal", preS: 15, postS: 8 }]);
    expect(effectiveEnd({ ...window, endS: null }, team)).toBe(108);
    expect(
      nudgeEdge({ ...window, endS: null }, "end", 1, 3600, team).endS,
    ).toBe(109);
  });
});

describe("nudgeEdge", () => {
  it("moves the start earlier and later", () => {
    expect(nudgeEdge(window, "start", -1, 3600, defaults).startS).toBe(99);
    expect(nudgeEdge(window, "start", 1, 3600, defaults).startS).toBe(101);
  });

  it("moves the end without touching the start", () => {
    expect(nudgeEdge(window, "end", 1, 3600, defaults)).toEqual({
      ...window,
      endS: 116,
    });
  });

  it("makes a default end explicit, starting from its effective value", () => {
    expect(
      nudgeEdge({ ...window, endS: null }, "end", 1, 3600, defaults).endS,
    ).toBe(106);
  });

  it("clamps to the start and the end of the game", () => {
    expect(
      nudgeEdge({ ...window, startS: 0.4 }, "start", -1, 3600, defaults).startS,
    ).toBe(0);
    expect(nudgeEdge(window, "end", 1, 115.5, defaults).endS).toBe(115.5);
  });
});

describe("isValidWindow", () => {
  it("accepts an end after the start, including the default window", () => {
    expect(isValidWindow(window, defaults)).toBe(true);
    expect(isValidWindow({ ...window, endS: null }, defaults)).toBe(true);
  });

  it("rejects an empty or inverted window", () => {
    expect(isValidWindow({ ...window, endS: 100 }, defaults)).toBe(false);
    expect(isValidWindow({ ...window, startS: 120 }, defaults)).toBe(false);
  });
});
