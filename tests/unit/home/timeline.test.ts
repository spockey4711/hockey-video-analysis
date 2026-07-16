import { describe, expect, it } from "vitest";

import {
  DEMO_GAME,
  markerLeftPercent,
  quarterBoundariesS,
} from "@/features/home/timeline";

describe("markerLeftPercent", () => {
  it("maps a clock time to its share of the track width", () => {
    expect(markerLeftPercent(0, 100)).toBe(0);
    expect(markerLeftPercent(25, 100)).toBe(25);
    expect(markerLeftPercent(100, 100)).toBe(100);
  });

  it("clamps out-of-range and degenerate inputs onto the track", () => {
    expect(markerLeftPercent(-10, 100)).toBe(0);
    expect(markerLeftPercent(200, 100)).toBe(100);
    expect(markerLeftPercent(30, 0)).toBe(0);
  });
});

describe("quarterBoundariesS", () => {
  it("returns evenly spaced boundaries including both ends", () => {
    expect(quarterBoundariesS(DEMO_GAME)).toEqual([0, 720, 1440, 2160, 2880]);
  });
});

describe("DEMO_GAME", () => {
  it("keeps every marker inside the game clock", () => {
    for (const marker of DEMO_GAME.markers) {
      expect(marker.atS).toBeGreaterThanOrEqual(0);
      expect(marker.atS).toBeLessThanOrEqual(DEMO_GAME.totalS);
    }
  });

  it("lists markers in clock order", () => {
    const times = DEMO_GAME.markers.map((m) => m.atS);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
