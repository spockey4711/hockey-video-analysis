import { describe, expect, it } from "vitest";

import {
  arrowHeadPath,
  blockBarPath,
  bodyPath,
  boardPenWidth,
  bodyStrokes,
  linePath,
} from "@/features/tactics/line-paths";
import type { BoardLine, LineTool } from "@/features/tactics/scene";

type Shape = Pick<BoardLine, "tool" | "points" | "width" | "style">;

function line(tool: LineTool, over: Partial<Shape> = {}): Shape {
  return {
    tool,
    width: "medium",
    style: tool === "run" ? "dotted" : "solid",
    points: [
      { x: 10, y: 20 },
      { x: 30, y: 20 },
    ],
    ...over,
  };
}

const BENT = [
  { x: 10, y: 20 },
  { x: 20, y: 0 },
  { x: 30, y: 20 },
];

/** The points a path of `M`/`L` commands visits, in order. */
function vertices(path: string): { x: number; y: number }[] {
  return [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
}

describe("linePath", () => {
  it("runs a straight play line from end to end", () => {
    expect(linePath(line("pass"))).toBe("M10 20L30 20");
  });

  it("bends a play line with three points like a curve", () => {
    expect(linePath(line("run", { points: BENT }))).toBe("M10 20Q20 0 30 20");
  });
});

describe("arrowHeadPath", () => {
  it("puts a head on runs, passes and dribbles but not on blocks or plain lines", () => {
    const heads = (["run", "pass", "dribble", "block", "line"] as const).map(
      (tool) => arrowHeadPath(line(tool)) !== null,
    );
    expect(heads).toEqual([true, true, true, false, false]);
  });

  it("points a bent play line's head along its end tangent", () => {
    const [tip, left, right] = vertices(
      arrowHeadPath(line("pass", { points: BENT })) ?? "",
    );
    expect(tip).toEqual({ x: 30, y: 20 });
    // The curve arrives from the control point (20, 0): the head's base
    // lies back along (-1, -2) from the tip.
    const base = {
      x: ((left?.x ?? 0) + (right?.x ?? 0)) / 2 - 30,
      y: ((left?.y ?? 0) + (right?.y ?? 0)) / 2 - 20,
    };
    expect(base.x * -2 - base.y * -1).toBeCloseTo(0);
    expect(base.y).toBeLessThan(0);
  });
});

describe("blockBarPath", () => {
  it("draws a bar across a block's end, centred on it", () => {
    const [from, to] = vertices(blockBarPath(line("block")) ?? "");
    expect(from?.x).toBeCloseTo(30);
    expect(to?.x).toBeCloseTo(30);
    expect(((from?.y ?? 0) + (to?.y ?? 0)) / 2).toBeCloseTo(20);
    // Wider than the pen, so it reads as a stop.
    expect(Math.abs((to?.y ?? 0) - (from?.y ?? 0))).toBeGreaterThan(
      boardPenWidth("medium") * 3,
    );
  });

  it("turns the bar with a bent block's end tangent", () => {
    const [from, to] = vertices(
      blockBarPath(line("block", { points: BENT })) ?? "",
    );
    // Arriving along (1, 2), the bar runs along (2, -1) or its reverse.
    const dx = (to?.x ?? 0) - (from?.x ?? 0);
    const dy = (to?.y ?? 0) - (from?.y ?? 0);
    expect(dx * 1 + dy * 2).toBeCloseTo(0);
  });

  it("is only for blocks", () => {
    expect(blockBarPath(line("pass"))).toBeNull();
  });
});

describe("bodyPath", () => {
  it("draws every line but the dribble as its plain path", () => {
    for (const tool of ["run", "pass", "block", "arrow"] as const) {
      expect(bodyPath(line(tool))).toBe(linePath(line(tool)));
    }
  });

  it("swings a dribble to either side and runs it straight into its head", () => {
    const points = vertices(bodyPath(line("dribble")));
    const offsets = points.map((point) => point.y - 20);
    expect(points[0]).toEqual({ x: 10, y: 20 });
    expect(points[points.length - 1]).toEqual({ x: 30, y: 20 });
    expect(Math.max(...offsets)).toBeGreaterThan(0.3);
    expect(Math.min(...offsets)).toBeLessThan(-0.3);
    // The swing stays within its amplitude of the line.
    const pen = boardPenWidth("medium");
    expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(
      pen * 1.2 + 1e-3,
    );
    // Along the way the wave only moves forward.
    const xs = points.map((point) => point.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it("follows a bent dribble's curve", () => {
    const points = vertices(bodyPath(line("dribble", { points: BENT })));
    expect(points[0]).toEqual({ x: 10, y: 20 });
    expect(points[points.length - 1]).toEqual({ x: 30, y: 20 });
    // Halfway along it has climbed to the curve's top at y = 10.
    const middle = points.find((point) => Math.abs(point.x - 20) < 0.5);
    expect(middle?.y).toBeGreaterThan(8);
    expect(middle?.y).toBeLessThan(12);
  });

  it("draws a dribble too short for one wave plain", () => {
    const short = line("dribble", {
      points: [
        { x: 10, y: 20 },
        { x: 11.5, y: 20 },
      ],
    });
    expect(bodyPath(short)).toBe(linePath(short));
  });
});

describe("bodyStrokes", () => {
  it("dots a run and draws a pass solid", () => {
    expect(bodyStrokes(line("run")).pen.dash).toBeDefined();
    expect(bodyStrokes(line("pass")).pen.dash).toBeUndefined();
  });
});
