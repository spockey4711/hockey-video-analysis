import { describe, expect, it } from "vitest";

import { formatGameClock } from "@/features/player/format-timecode";

describe("formatGameClock", () => {
  it("formats sub-hour times as M:SS with padded seconds", () => {
    expect(formatGameClock(0)).toBe("0:00");
    expect(formatGameClock(5)).toBe("0:05");
    expect(formatGameClock(65)).toBe("1:05");
    expect(formatGameClock(600)).toBe("10:00");
  });

  it("switches to H:MM:SS once the game reaches an hour", () => {
    expect(formatGameClock(3600)).toBe("1:00:00");
    expect(formatGameClock(3661)).toBe("1:01:01");
    expect(formatGameClock(7325)).toBe("2:02:05");
  });

  it("floors fractional seconds", () => {
    expect(formatGameClock(65.9)).toBe("1:05");
  });

  it("clamps non-finite or negative input to 0:00", () => {
    expect(formatGameClock(-10)).toBe("0:00");
    expect(formatGameClock(Number.NaN)).toBe("0:00");
    expect(formatGameClock(Number.POSITIVE_INFINITY)).toBe("0:00");
  });
});
