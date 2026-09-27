import { describe, expect, it, vi } from "vitest";

import {
  curveThrough,
  dashPattern,
  DOT_HALO_SIZE,
  DOT_SIZE,
  penWidth,
} from "@/features/player/telestration/geometry";
import {
  ARROW_ALPHA,
  arrowBarbs,
  drawStrokes,
  paintOrder,
  SPOTLIGHT_FILL_ALPHA,
} from "@/features/player/telestration/render";
import {
  MAGNIFIER_ZOOM,
  SPOTLIGHT_TILT,
} from "@/features/player/telestration/spots";
import type {
  DrawTool,
  LineStyle,
  Stroke,
  StrokeWidth,
} from "@/features/player/telestration/state";

const palette = {
  pens: { red: "#f00", yellow: "#ff0", blue: "#00f", white: "#fff" },
  halo: "#000",
};
const picture = { x: 0, y: 0, width: 1280, height: 720 };

/**
 * A 2D context that records which drawing calls were made with which
 * arguments, and the alpha and line width in force at each one. It has no canvas, so arrows take the
 * paint-in-place fallback rather than an offscreen layer.
 */
function recordingContext() {
  const calls: string[] = [];
  const states: {
    call: string;
    args: unknown[];
    alpha: number;
    lineWidth: number;
  }[] = [];
  let alpha = 1;
  let lineWidth = 1;
  const saved: { alpha: number; lineWidth: number }[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === "globalAlpha") return alpha;
        if (key === "canvas") return undefined;
        return vi.fn((...args: unknown[]) => {
          const call = String(key);
          calls.push(call);
          states.push({ call, args, alpha, lineWidth });
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

function stroke(
  tool: DrawTool,
  width: StrokeWidth = "medium",
  style: LineStyle = "solid",
): Stroke {
  return {
    tool,
    color: "red",
    width,
    style,
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

  it.each<DrawTool>(["arrow", "curve"])("fills a %s's head", (tool) => {
    const { ctx, calls } = recordingContext();
    drawStrokes(ctx, [stroke(tool)], picture, palette);
    expect(calls.filter((call) => call === "fill")).toHaveLength(1);
  });

  it.each<DrawTool>(["arrow", "curve"])(
    "draws a %s translucent, so players under it stay visible",
    (tool) => {
      const { ctx, states } = recordingContext();
      drawStrokes(ctx, [stroke(tool)], picture, palette);
      const painted = states.filter(
        ({ call }) => call === "stroke" || call === "fill",
      );
      expect(ARROW_ALPHA).toBeLessThan(1);
      for (const { alpha } of painted) {
        expect(alpha).toBeLessThanOrEqual(ARROW_ALPHA);
      }
    },
  );

  it("bends a curve through the drag and points its head along the end tangent", () => {
    const { ctx, states } = recordingContext();
    const curved = stroke("curve");
    drawStrokes(ctx, [curved], picture, palette);
    const curve = curveThrough(curved.points)!;
    const bend = states.find(({ call }) => call === "quadraticCurveTo");
    expect(bend?.args).toEqual([
      curve.control.x * picture.width,
      curve.control.y * picture.height,
      curve.end.x * picture.width,
      curve.end.y * picture.height,
    ]);
    // The head's barbs sit behind the tip on the side of the control point.
    const tip = {
      x: curve.end.x * picture.width,
      y: curve.end.y * picture.height,
    };
    const heads = states.filter(({ call }) => call === "lineTo").slice(-2);
    const width = penWidth(picture.width, "medium");
    const [left, right] = arrowBarbs(
      {
        x: curve.control.x * picture.width,
        y: curve.control.y * picture.height,
      },
      tip,
      width,
    );
    expect(heads.map(({ args }) => args)).toEqual([
      [left.x, left.y],
      [right.x, right.y],
    ]);
  });

  it("dots a dotted stroke's body for halo and pen, spaced for the pen", () => {
    const { ctx, states } = recordingContext();
    drawStrokes(ctx, [stroke("freehand", "thick", "dotted")], picture, palette);
    const width = penWidth(picture.width, "thick");
    const dashes = states.filter(({ call }) => call === "setLineDash");
    expect(dashes.map(({ args }) => args[0])).toEqual([
      dashPattern(width),
      [],
      dashPattern(width),
      [],
    ]);
    const dots = states
      .filter(({ call }) => call === "stroke")
      .map(({ lineWidth }) => lineWidth);
    expect(dots[0]).toBeCloseTo(width * DOT_HALO_SIZE);
    expect(dots[1]).toBeCloseTo(width * DOT_SIZE);
  });

  it("keeps a dotted arrow's head solid", () => {
    const { ctx, states } = recordingContext();
    drawStrokes(ctx, [stroke("arrow", "medium", "dotted")], picture, palette);
    let dashed = false;
    for (const { call, args } of states) {
      if (call === "setLineDash") dashed = (args[0] as number[]).length > 0;
      if (call === "fill") expect(dashed).toBe(false);
    }
  });

  it("never dots a solid stroke", () => {
    const { ctx, states } = recordingContext();
    drawStrokes(ctx, [stroke("arrow")], picture, palette);
    for (const { call, args } of states) {
      if (call === "setLineDash") expect(args[0]).toEqual([]);
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

  it("sizes pens for the frame on screen when the picture is shown zoomed", () => {
    const { ctx, states } = recordingContext();
    const zoomed = { x: -640, y: -360, width: 2560, height: 1440 };
    drawStrokes(ctx, [stroke("freehand")], zoomed, palette, picture.width);
    const pen = states.filter(({ call }) => call === "stroke").at(-1);
    expect(pen?.lineWidth).toBeCloseTo(penWidth(picture.width, "medium"));
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

/** Each of `actual` close to its counterpart in `expected`, past float noise. */
function expectClose(actual: unknown[] | undefined, expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    expect(actual?.[index]).toBeCloseTo(value);
  });
}

describe("drawStrokes with spot tools", () => {
  const frame = { image: {} as CanvasImageSource, width: 1920, height: 1080 };

  function spot(tool: DrawTool, color: Stroke["color"] = "yellow"): Stroke {
    return {
      tool,
      color,
      width: "medium",
      style: "solid",
      points: [
        { x: 0.5, y: 0.5 },
        { x: 0.55, y: 0.5 },
      ],
    };
  }

  it("lays a spotlight flat on the pitch: a tilted ellipse, lit up and ringed", () => {
    const { ctx, states } = recordingContext();
    drawStrokes(ctx, [spot("spotlight")], picture, palette);
    const ellipse = states.find(({ call }) => call === "ellipse");
    expectClose(ellipse?.args.slice(0, 4), [640, 360, 64, 64 * SPOTLIGHT_TILT]);
    const fills = states.filter(({ call }) => call === "fill");
    expect(fills).toHaveLength(1);
    expect(fills[0]?.alpha).toBeCloseTo(SPOTLIGHT_FILL_ALPHA);
    // The glow first, then the halo and pen rings over it.
    const painted = states
      .filter(({ call }) => call === "fill" || call === "stroke")
      .map(({ call }) => call);
    expect(painted).toEqual(["fill", "stroke", "stroke"]);
  });

  it("shows the picture under a magnifier enlarged inside its round lens", () => {
    const { ctx, states } = recordingContext();
    drawStrokes(
      ctx,
      [spot("magnifier")],
      picture,
      palette,
      picture.width,
      frame,
    );
    const lens = states.find(({ call }) => call === "ellipse");
    expectClose(lens?.args.slice(0, 4), [640, 360, 64, 64]);
    const calls = states.map(({ call }) => call);
    expect(calls.indexOf("clip")).toBeLessThan(calls.indexOf("drawImage"));
    // The lens is 128 px wide on a 1280 px picture: a tenth of the frame,
    // halved by the zoom, fills it.
    const half = ((64 / 1280) * 1920) / MAGNIFIER_ZOOM;
    const halfH = ((64 / 720) * 1080) / MAGNIFIER_ZOOM;
    const image = states.find(({ call }) => call === "drawImage");
    expectClose(image?.args.slice(1), [
      960 - half,
      540 - halfH,
      half * 2,
      halfH * 2,
      576,
      296,
      128,
      128,
    ]);
  });

  it("keeps a magnifier's lens dark while there is no frame to enlarge", () => {
    const { ctx, calls } = recordingContext();
    drawStrokes(ctx, [spot("magnifier")], picture, palette);
    expect(calls).not.toContain("drawImage");
    expect(calls).toContain("clip");
  });

  it("paints a magnifier under the other strokes, so they point into it", () => {
    const circle = stroke("circle");
    const lens = spot("magnifier");
    expect(paintOrder([circle, lens])).toEqual([lens, circle]);

    const { ctx, calls } = recordingContext();
    drawStrokes(ctx, [circle, lens], picture, palette, picture.width, frame);
    const lastStroke = calls.lastIndexOf("stroke");
    expect(calls.indexOf("drawImage")).toBeLessThan(lastStroke);
    expect(calls.indexOf("drawImage")).toBeLessThan(calls.indexOf("stroke"));
  });
});
