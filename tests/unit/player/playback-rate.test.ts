import { describe, expect, it } from "vitest";

import {
  adjustPlaybackRate,
  DEFAULT_PLAYBACK_RATE,
  formatPlaybackRate,
  nextPlaybackRate,
  PLAYBACK_RATES,
} from "@/features/player/playback-rate";

describe("nextPlaybackRate", () => {
  it("cycles 1 -> 2 -> 4 -> 1", () => {
    expect(nextPlaybackRate(1)).toBe(2);
    expect(nextPlaybackRate(2)).toBe(4);
    expect(nextPlaybackRate(4)).toBe(1);
  });

  it("falls back to normal speed for an unknown rate", () => {
    expect(nextPlaybackRate(0.5)).toBe(DEFAULT_PLAYBACK_RATE);
    expect(nextPlaybackRate(3)).toBe(DEFAULT_PLAYBACK_RATE);
  });
});

describe("adjustPlaybackRate", () => {
  it("steps up and down within the scan steps", () => {
    expect(adjustPlaybackRate(1, 1)).toBe(2);
    expect(adjustPlaybackRate(2, 1)).toBe(4);
    expect(adjustPlaybackRate(4, -1)).toBe(2);
    expect(adjustPlaybackRate(2, -1)).toBe(1);
  });

  it("clamps at the ends instead of wrapping", () => {
    expect(adjustPlaybackRate(PLAYBACK_RATES[0], -1)).toBe(1);
    expect(adjustPlaybackRate(4, 1)).toBe(4);
  });

  it("falls back to normal speed for an unknown rate", () => {
    expect(adjustPlaybackRate(0.5, 1)).toBe(DEFAULT_PLAYBACK_RATE);
  });
});

describe("formatPlaybackRate", () => {
  it("renders the multiplier suffix", () => {
    expect(formatPlaybackRate(1)).toBe("1x");
    expect(formatPlaybackRate(4)).toBe("4x");
  });
});
