import { describe, expect, it } from "vitest";

import { FALLBACK_CLIP_WINDOW_S, resolveClipEnd } from "@/features/clips/cut";
import { DEFAULT_TAG_WINDOWS, resolveTagWindows } from "@/lib/tag-types";

const defaults = DEFAULT_TAG_WINDOWS;

describe("resolveClipEnd", () => {
  it("uses the persisted end when the tag has one", () => {
    expect(resolveClipEnd(100, 115, "goal", defaults)).toBe(115);
  });

  it("keeps a persisted end whatever the team's window is", () => {
    const team = resolveTagWindows([{ type: "goal", preS: 15, postS: 20 }]);
    expect(resolveClipEnd(100, 115, "goal", team)).toBe(115);
  });

  it("falls back to the tag type's follow-through for an open-ended tag", () => {
    // `goal` is configured with postS = 5 (src/lib/tag-types/config.ts).
    expect(resolveClipEnd(100, null, "goal", defaults)).toBe(105);
  });

  it("falls back to the team's follow-through when the team set one", () => {
    const team = resolveTagWindows([{ type: "goal", preS: 15, postS: 8 }]);
    expect(resolveClipEnd(100, null, "goal", team)).toBe(108);
  });

  it("falls back to the fixed window for a type that is no longer configured", () => {
    expect(resolveClipEnd(100, null, "retired_type", defaults)).toBe(
      100 + FALLBACK_CLIP_WINDOW_S,
    );
    expect(resolveClipEnd(100, null, "toString", defaults)).toBe(
      100 + FALLBACK_CLIP_WINDOW_S,
    );
  });

  it("rejects an end that does not lie after its start", () => {
    expect(() => resolveClipEnd(100, 100, "goal", defaults)).toThrow(
      RangeError,
    );
    expect(() => resolveClipEnd(100, 90, "goal", defaults)).toThrow(RangeError);
  });

  it("rejects a start that is not a finite, non-negative time", () => {
    expect(() => resolveClipEnd(-1, 10, "goal", defaults)).toThrow(RangeError);
    expect(() => resolveClipEnd(Number.NaN, 10, "goal", defaults)).toThrow(
      RangeError,
    );
  });
});
