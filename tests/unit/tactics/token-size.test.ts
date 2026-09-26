import { describe, expect, it } from "vitest";

import { GOAL_WIDTH } from "@/features/tactics/pitch";
import { boardSizes, labelFontSize } from "@/features/tactics/token-size";

describe("board sizes per view", () => {
  it("keeps the whole pitch's tokens as they were", () => {
    const full = boardSizes("full");
    expect(full.player).toBe(1.2);
    expect(full.ball).toBe(0.55);
    expect(full.hit).toBe(2);
    expect(full.pen).toBe(1);
    expect(full.labelMinPx).toBe(0);
    expect(labelFontSize("7", full, 12)).toBeCloseTo(1.3);
    expect(labelFontSize("TW12", full, 12)).toBeCloseTo(0.95);
  });

  it("fits five players side by side in the goal mouth with a gap in a short-corner view", () => {
    const corner = boardSizes("corner");
    // Each disc drawn with its edge, five across between the posts.
    const disc = 2 * corner.player + corner.edge;
    const gap = (GOAL_WIDTH - 5 * disc) / 6;
    expect(gap).toBeGreaterThan(0.05);
    // The ball keeps its share of a player.
    expect(corner.ball / corner.player).toBeCloseTo(0.55 / 1.2);
  });

  it("draws the short-corner ring, trail, handle and pen smaller with the tokens", () => {
    const full = boardSizes("full");
    const corner = boardSizes("corner");
    expect(corner.ringGap).toBeLessThan(full.ringGap);
    expect(corner.ringWidth).toBeLessThan(full.ringWidth);
    expect(corner.trail).toBeLessThan(full.trail);
    expect(corner.bend).toBeLessThan(full.bend);
    expect(corner.pen).toBeLessThan(full.pen);
  });

  it("keeps what a finger hits in a short-corner view larger than what is drawn", () => {
    const corner = boardSizes("corner");
    expect(corner.hit).toBeGreaterThan(corner.player * 2);
    expect(corner.bendHit).toBeGreaterThan(corner.bend * 2);
  });

  it("grows a short-corner label to a readable size on screen", () => {
    const corner = boardSizes("corner");
    const fits = labelFontSize("7", corner, 0);
    expect(fits).toBeCloseTo(0.325);
    // At 12 px a metre (a phone) the label is at least 9 px.
    expect(labelFontSize("7", corner, 12) * 12).toBeCloseTo(9);
    expect(labelFontSize("TW12", corner, 12) * 12).toBeCloseTo(9);
    // On a screen large enough the disc's own size reads already.
    expect(labelFontSize("7", corner, 100)).toBeCloseTo(fits);
  });
});
