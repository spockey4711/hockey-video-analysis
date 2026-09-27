import { describe, expect, it } from "vitest";

import { spotOnPicture } from "@/features/share/presentation/audience-pointer";
import {
  formatElapsed,
  formatTimeOfDay,
} from "@/features/share/presentation/presenter-clock";

describe("spotOnPicture", () => {
  // A 16:9 picture in a 1000 x 1000 box: bars above and below.
  const picture = { width: 1920, height: 1080 };

  it("places the spot on the picture fitted into its box", () => {
    expect(
      spotOnPicture({ x: 500, y: 500, width: 1000, height: 1000 }, picture),
    ).toEqual({ x: 0.5, y: 0.5 });
    const corner = spotOnPicture(
      { x: 0, y: 218.75, width: 1000, height: 1000 },
      picture,
    );
    expect(corner?.x).toBeCloseTo(0);
    expect(corner?.y).toBeCloseTo(0);
  });

  it("has no spot over the bars beside the picture", () => {
    expect(
      spotOnPicture({ x: 500, y: 100, width: 1000, height: 1000 }, picture),
    ).toBeNull();
  });
});

describe("presenter clock", () => {
  it("shows the time of day in hours and minutes", () => {
    expect(formatTimeOfDay(new Date(2026, 8, 26, 9, 5))).toBe("09:05");
  });

  it("shows how long it ran, in hours only past one", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(247_900)).toBe("4:07");
    expect(formatElapsed(3_847_000)).toBe("1:04:07");
    expect(formatElapsed(-5_000)).toBe("0:00");
  });
});
