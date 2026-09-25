import { describe, expect, it, vi } from "vitest";

import { penWidth } from "@/features/player/telestration/geometry";
import {
  ARROW_ALPHA,
  arrowBarbs,
  drawStrokes,
} from "@/features/player/telestration/render";
import type {
  DrawTool,
  Stroke,
  StrokeWidth,
} from "@/features/player/telestration/state";

const palette = {
  pens: { red: "#f00", yellow: "#ff0", blue: "#00f", white: "#fff" },
  halo: "#000",
};
const picture = { x: 0, y: 0, width: 1280, height: 720 };

/**
 * A 2D context that records which drawing calls were made, and the alpha and
 * line width in force at each one. It has no canvas, so arrows take the
 * paint-in-place fallback rather than an offscreen layer.
 */
function recordingContext() {
  const calls: string[] = [];
  const states: { call: string; alpha: number; lineWidth: number }[] = [];
  let alpha = 1;
  let lineWidth = 1;
  const saved: { alpha: number; lineWidth: number }[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === "globalAlpha") return alpha;
        if (key === "canvas") return undefined;
        return vi.fn(() => {
          const call = String(key);
          calls.push(call);
          states.push({ call, alpha, lineWidth });
          if (call === "save") saved.push({ alpha, lineWidth });
          if (call === "restore") ({ alpha, lineWidth } = saved.pop()!);
        });
      },
      set: (_target, key, value: number) => {
        if (key === "globalAlpha") alpha = value;
        if (key === "lineWidth") lineWidth = value;
        return true;
      },
    },
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, states };
}

function stroke(tool: DrawTool, width: StrokeWidth = "medium"): Stroke {
  return {
    tool,
    color: "red",
    width,
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.2 },
      { x: 0.5, y: 0.5 },
    ],
  };
}

describe("drawStrokes", () => {
  it.each<DrawTool>(["circle", "freehand"])(
    "only outlines a %s, never fills it",
    (tool) => {
      const { ctx, calls } = recordingContext();
      drawStrokes(ctx, [stroke(tool)], picture, palette);
      expect(calls).not.toContain("fill");
      // One pass for the halo, one for the pen.
      expect(calls.filter((call) => call === "stroke")).toHaveLength(2);
    },
  );

  it("fills an arrow's head", () => {
    const { ctx, calls } = recordingContext();
    drawStrokes(ctx, [stroke("arrow")], picture, palette);
    expect(calls.filter((call) => call === "fill")).toHaveLength(1);
  });

  it("draws an arrow translucent, so players under it stay visible", () => {
    const { ctx, states } = recordingContext();
    drawStrokes(ctx, [stroke("arrow")], picture, palette);
    const painted = states.filter(
      ({ call }) => call === "stroke" || call === "fill",
    );
    expect(ARROW_ALPHA).toBeLessThan(1);
    for (const { alpha } of painted) {
      expect(alpha).toBeLessThanOrEqual(ARROW_ALPHA);
    }
  });

  it.each<DrawTool>(["circle", "freehand"])(
    "keeps the %s pen itself fully opaque",
    (tool) => {
      const { ctx, states } = recordingContext();
      drawStrokes(ctx, [stroke(tool)], picture, palette);
      const pen = states.filter(({ call }) => call === "stroke").at(-1);
      expect(pen?.alpha).toBe(1);
    },
  );

  it("draws each stroke with its own width", () => {
    const { ctx, states } = recordingContext();
    drawStrokes(
      ctx,
      [stroke("freehand", "thin"), stroke("freehand", "thick")],
      picture,
      palette,
    );
    // Halo then pen for each stroke: the pen passes are the 2nd and 4th.
    const widths = states
      .filter(({ call }) => call === "stroke")
      .map(({ lineWidth }) => lineWidth);
    expect(widths[1]).toBeCloseTo(penWidth(picture.width, "thin"));
    expect(widths[3]).toBeCloseTo(penWidth(picture.width, "thick"));
  });
});

describe("arrowBarbs", () => {
  const tail = { x: 0, y: 0 };
  const tip = { x: 100, y: 0 };

  it("keeps the head short: no longer than three pen widths", () => {
    const [left, right] = arrowBarbs(tail, tip, 5);
    expect(Math.hypot(tip.x - left.x, tip.y - left.y)).toBeCloseTo(15);
    expect(Math.hypot(tip.x - right.x, tip.y - right.y)).toBeCloseTo(15);
  });

  it("keeps a thin arrow's head big enough to show its direction", () => {
    const [thin] = arrowBarbs(tail, tip, 2.5, 5);
    const [medium] = arrowBarbs(tail, tip, 5, 5);
    const thinLength = Math.hypot(tip.x - thin.x, tip.y - thin.y);
    const mediumLength = Math.hypot(tip.x - medium.x, tip.y - medium.y);
    expect(thinLength).toBeCloseTo(mediumLength * 0.8);
  });

  it("sweeps the barbs back symmetrically behind the tip", () => {
    const [left, right] = arrowBarbs(tail, tip, 5);
    expect(left.x).toBeLessThan(tip.x);
    expect(left.x).toBeCloseTo(right.x);
    expect(left.y).toBeCloseTo(-right.y);
    // A narrow head: spread at the base smaller than its length.
    expect(Math.abs(left.y - right.y)).toBeLessThan(15);
  });
});
