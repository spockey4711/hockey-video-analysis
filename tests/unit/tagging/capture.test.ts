import { describe, expect, it } from "vitest";

import { captureTag, formatClock } from "@/features/tagging/capture";
import type { TagTypeDef } from "@/lib/tag-types";

const goal: TagTypeDef = {
  key: "goal",
  label: "Tor",
  hotkey: "t",
  tone: "success",
  window: { preS: 10, postS: 5 },
};

describe("captureTag", () => {
  it("applies the type's default window around the capture point", () => {
    expect(captureTag(goal, 100)).toEqual({
      type: "goal",
      startS: 90,
      endS: 105,
    });
  });

  it("clamps the start at the game start", () => {
    expect(captureTag(goal, 4)).toEqual({ type: "goal", startS: 0, endS: 9 });
  });

  it("clamps the end and capture point at the game end", () => {
    // atS past the total is pulled back to maxS before the window is applied.
    expect(captureTag(goal, 250, { maxS: 200 })).toEqual({
      type: "goal",
      startS: 190,
      endS: 200,
    });
  });

  it("leaves the end unclamped when no duration is given", () => {
    expect(captureTag(goal, 100).endS).toBe(105);
  });

  it("rejects a non-finite or negative capture time", () => {
    expect(() => captureTag(goal, -1)).toThrow(RangeError);
    expect(() => captureTag(goal, Number.NaN)).toThrow(RangeError);
  });

  it("rejects a non-positive game duration", () => {
    expect(() => captureTag(goal, 10, { maxS: 0 })).toThrow(RangeError);
  });
});

describe("formatClock", () => {
  it("formats sub-hour offsets as m:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(90)).toBe("1:30");
    expect(formatClock(124.7)).toBe("2:04");
  });

  it("formats hour-plus offsets as h:mm:ss", () => {
    expect(formatClock(3661)).toBe("1:01:01");
  });

  it("formats invalid input as 0:00", () => {
    expect(formatClock(-5)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
  });
});
