import { describe, expect, it } from "vitest";

import { FALLBACK_CLIP_WINDOW_S, resolveClipEnd } from "@/features/clips/cut";

describe("resolveClipEnd", () => {
  it("uses the persisted end when the tag has one", () => {
    expect(resolveClipEnd(100, 115, "goal")).toBe(115);
  });

  it("falls back to the tag type's follow-through for an open-ended tag", () => {
    // `goal` is configured with postS = 5 (src/lib/tag-types/config.ts).
    expect(resolveClipEnd(100, null, "goal")).toBe(105);
  });

  it("falls back to the fixed window for a type that is no longer configured", () => {
    expect(resolveClipEnd(100, null, "retired_type")).toBe(
      100 + FALLBACK_CLIP_WINDOW_S,
    );
  });

  it("rejects an end that does not lie after its start", () => {
    expect(() => resolveClipEnd(100, 100, "goal")).toThrow(RangeError);
    expect(() => resolveClipEnd(100, 90, "goal")).toThrow(RangeError);
  });

  it("rejects a start that is not a finite, non-negative time", () => {
    expect(() => resolveClipEnd(-1, 10, "goal")).toThrow(RangeError);
    expect(() => resolveClipEnd(Number.NaN, 10, "goal")).toThrow(RangeError);
  });
});
