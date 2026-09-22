import { describe, expect, it } from "vitest";

import {
  adjustPlaybackRate,
  DEFAULT_PLAYBACK_RATE,
  formatPlaybackRate,
  isSlowMotion,
  nextPlaybackRate,
  PLAYBACK_RATES,
} from "@/features/player/playback-rate";

describe("nextPlaybackRate", () => {
  it("cycles the whole ladder 0.25 -> 0.5 -> 1 -> 2 -> 4 -> 0.25", () => {
    expect(nextPlaybackRate(0.25)).toBe(0.5);
    expect(nextPlaybackRate(0.5)).toBe(1);
    expect(nextPlaybackRate(1)).toBe(2);
    expect(nextPlaybackRate(2)).toBe(4);
    expect(nextPlaybackRate(4)).toBe(0.25);
  });

  it("falls back to normal speed for an unknown rate", () => {
    expect(nextPlaybackRate(0.75)).toBe(DEFAULT_PLAYBACK_RATE);
    expect(nextPlaybackRate(3)).toBe(DEFAULT_PLAYBACK_RATE);
  });
});

describe("adjustPlaybackRate", () => {
  it("steps up and down through slow motion and scan", () => {
    expect(adjustPlaybackRate(1, -1)).toBe(0.5);
    expect(adjustPlaybackRate(0.5, -1)).toBe(0.25);
    expect(adjustPlaybackRate(0.25, 1)).toBe(0.5);
    expect(adjustPlaybackRate(1, 1)).toBe(2);
    expect(adjustPlaybackRate(2, 1)).toBe(4);
    expect(adjustPlaybackRate(4, -1)).toBe(2);
  });

  it("clamps at the ends instead of wrapping", () => {
    expect(adjustPlaybackRate(PLAYBACK_RATES[0], -1)).toBe(PLAYBACK_RATES[0]);
    expect(adjustPlaybackRate(4, 1)).toBe(4);
  });

  it("falls back to normal speed for an unknown rate", () => {
    expect(adjustPlaybackRate(0.75, 1)).toBe(DEFAULT_PLAYBACK_RATE);
  });
});

describe("isSlowMotion", () => {
  it("is true only below normal speed", () => {
    expect(isSlowMotion(0.25)).toBe(true);
    expect(isSlowMotion(0.5)).toBe(true);
    expect(isSlowMotion(1)).toBe(false);
    expect(isSlowMotion(2)).toBe(false);
  });
});

describe("formatPlaybackRate", () => {
  it("renders the multiplier suffix", () => {
    expect(formatPlaybackRate(1)).toBe("1x");
    expect(formatPlaybackRate(4)).toBe("4x");
  });

  it("writes a fractional rate with a German decimal comma", () => {
    expect(formatPlaybackRate(0.5)).toBe("0,5x");
    expect(formatPlaybackRate(0.25)).toBe("0,25x");
  });
});
