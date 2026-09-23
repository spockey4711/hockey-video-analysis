import { describe, expect, it, vi } from "vitest";

import { drawStrokes } from "@/features/player/telestration/render";
import type { DrawTool, Stroke } from "@/features/player/telestration/state";

const palette = {
  pens: { red: "#f00", yellow: "#ff0", blue: "#00f", white: "#fff" },
  halo: "#000",
};
const picture = { x: 0, y: 0, width: 1280, height: 720 };

/** A 2D context that records which drawing calls were made. */
function recordingContext() {
  const calls: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => vi.fn(() => calls.push(String(key))),
      set: () => true,
    },
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

function stroke(tool: DrawTool): Stroke {
  return {
    tool,
    color: "red",
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
});
