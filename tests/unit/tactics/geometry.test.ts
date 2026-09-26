import { describe, expect, it } from "vitest";

import {
  boardLayout,
  clampToBoard,
  clientToPitch,
  fromView,
  overlapsBounds,
  roundPoint,
  screenToPitchDelta,
  toView,
  viewMatrix,
  viewSize,
  type BoardLayout,
  type Orientation,
} from "@/features/tactics/geometry";
import {
  BOARD_BOUNDS,
  CENTRE,
  PITCH_VIEWS,
  viewBounds,
} from "@/features/tactics/pitch";

const ORIENTATIONS: Orientation[] = ["landscape", "portrait"];
const LANDSCAPE = boardLayout("full", "landscape");
const PORTRAIT = boardLayout("full", "portrait");
/** Every view on every screen, named for the test titles. */
const LAYOUTS: [string, BoardLayout][] = PITCH_VIEWS.flatMap((view) =>
  ORIENTATIONS.map((orientation): [string, BoardLayout] => [
    `${view} ${orientation}`,
    boardLayout(view, orientation),
  ]),
);

/** Apply an SVG `matrix(a b c d e f)` string to a point, as the browser would. */
function applyMatrix(matrix: string, x: number, y: number) {
  const [a, b, c, d, e, f] = matrix
    .slice("matrix(".length, -1)
    .split(" ")
    .map(Number) as [number, number, number, number, number, number];
  return { u: a * x + c * y + e, v: b * x + d * y + f };
}

describe("view transforms", () => {
  it("sizes the view to the board, turned upright in portrait", () => {
    expect(viewSize(LANDSCAPE)).toEqual({ width: 97.4, height: 59 });
    expect(viewSize(PORTRAIT)).toEqual({ width: 59, height: 97.4 });
  });

  it("puts the left goal on the left in landscape and at the bottom in portrait", () => {
    expect(toView({ x: 0, y: 27.5 }, LANDSCAPE)).toEqual({ u: 3, v: 29.5 });
    expect(toView({ x: 0, y: 27.5 }, PORTRAIT)).toEqual({ u: 29.5, v: 94.4 });
  });

  it.each(LAYOUTS)("round-trips points in %s", (_name, layout) => {
    const point = { x: 12.5, y: 40 };
    const { u, v } = toView(point, layout);
    expect(fromView(u, v, layout).x).toBeCloseTo(point.x);
    expect(fromView(u, v, layout).y).toBeCloseTo(point.y);
  });

  it.each(LAYOUTS)(
    "draws with the same transform it maps pointers with in %s",
    (_name, layout) => {
      const point = { x: 70, y: 5 };
      expect(applyMatrix(viewMatrix(layout), point.x, point.y)).toEqual(
        toView(point, layout),
      );
    },
  );

  it.each(LAYOUTS)("fills the view with its bounds in %s", (_name, layout) => {
    // The bounds' corners land on the view's corners, in some order.
    const { minX, minY, maxX, maxY } = layout.bounds;
    const { width, height } = viewSize(layout);
    const corners = [
      toView({ x: minX, y: minY }, layout),
      toView({ x: maxX, y: maxY }, layout),
    ];
    const us = corners.map((corner) => corner.u).sort((a, b) => a - b);
    const vs = corners.map((corner) => corner.v).sort((a, b) => a - b);
    expect(us[0]).toBeCloseTo(0);
    expect(us[1]).toBeCloseTo(width);
    expect(vs[0]).toBeCloseTo(0);
    expect(vs[1]).toBeCloseTo(height);
  });
});

describe("short-corner views", () => {
  it("crops one quarter of the field at the left goal: behind the back-line to past the 23 m line", () => {
    expect(viewBounds("full")).toEqual(BOARD_BOUNDS);
    expect(viewBounds("corner")).toEqual({
      minX: -3,
      minY: -2,
      maxX: 23.9,
      maxY: 57,
    });
  });

  it("lies across a landscape screen with its goal at the top", () => {
    const layout = boardLayout("corner", "landscape");
    // Exact, so the SVG view box reads `0 0 59 26.9`.
    expect(viewSize(layout)).toEqual({ width: 59, height: 26.9 });
    const { u, v } = toView({ x: 0, y: CENTRE.y }, layout);
    expect(u).toBeCloseTo(29.5);
    expect(v).toBeCloseTo(3);
  });

  it("stands upright as it is on a phone", () => {
    const layout = boardLayout("corner", "portrait");
    expect(layout.turn).toBe("none");
    expect(viewSize(layout).width).toBeCloseTo(26.9);
    expect(viewSize(layout).height).toBeCloseTo(59);
  });

  it("sees the circle and the broken line, not the half-way line", () => {
    const bounds = viewBounds("corner");
    // The top of the broken line, 19.63 m out, and the injection mark.
    expect(overlapsBounds([{ x: 19.6, y: CENTRE.y }], bounds)).toBe(true);
    expect(overlapsBounds([{ x: 0, y: 15.62 }], bounds)).toBe(true);
    expect(overlapsBounds([CENTRE], bounds)).toBe(false);
    // A line from outside into the quarter still shows.
    expect(overlapsBounds([CENTRE, { x: 10, y: 10 }], bounds)).toBe(true);
    // A disc just past the edge reaches in by its radius.
    expect(overlapsBounds([{ x: 24.5, y: 10 }], bounds, 1.2)).toBe(true);
    expect(overlapsBounds([{ x: 24.5, y: 10 }], bounds)).toBe(false);
  });
});

describe("clientToPitch", () => {
  it("maps a pointer on a box of the board's shape", () => {
    // 974 x 590 px: ten pixels per metre, board origin at the box's corner.
    const box = { left: 100, top: 50, width: 974, height: 590 };
    const at = clientToPitch(100 + 487, 50 + 295, box, LANDSCAPE);
    expect(at.x).toBeCloseTo(CENTRE.x);
    expect(at.y).toBeCloseTo(CENTRE.y);
  });

  it("accounts for the letterbox when the box is wider than the board", () => {
    // Twice as wide as needed: the board is centred with bars left and right.
    const box = { left: 0, top: 0, width: 1948, height: 590 };
    const at = clientToPitch(487 + 30, 20, box, LANDSCAPE);
    expect(at.x).toBeCloseTo(0);
    expect(at.y).toBeCloseTo(0);
  });

  it("maps through the quarter turn in portrait", () => {
    const box = { left: 0, top: 0, width: 590, height: 974 };
    // Bottom middle of the portrait view is the left end of the pitch.
    const at = clientToPitch(295, 974 - 30, box, PORTRAIT);
    expect(at.x).toBeCloseTo(0);
    expect(at.y).toBeCloseTo(CENTRE.y);
  });

  it("clamps a pointer off a short-corner quarter onto its edge", () => {
    // 590 x 269 px: the left quarter across the screen at ten pixels a metre.
    const layout = boardLayout("corner", "landscape");
    const box = { left: 0, top: 0, width: 590, height: 269 };
    expect(clientToPitch(295, 5000, box, layout)).toEqual({
      x: 23.9,
      y: CENTRE.y,
    });
  });

  it("clamps a pointer off the board onto its edge", () => {
    const box = { left: 0, top: 0, width: 974, height: 590 };
    expect(clientToPitch(-500, 5000, box, LANDSCAPE)).toEqual({
      x: BOARD_BOUNDS.minX,
      y: BOARD_BOUNDS.maxY,
    });
  });
});

describe("helpers", () => {
  it("turns an arrow key into the pitch move that points the same way on screen", () => {
    expect(screenToPitchDelta(1, 0, LANDSCAPE)).toEqual({ x: 1, y: 0 });
    // Portrait: screen right is towards the bottom side-line, screen up
    // towards the right goal.
    expect(screenToPitchDelta(1, 0, PORTRAIT)).toEqual({ x: 0, y: 1 });
    expect(screenToPitchDelta(0, -1, PORTRAIT)).toEqual({ x: 1, y: 0 });
    // The left corner turned right: screen up is towards the left goal,
    // screen right towards the top side-line.
    const corner = boardLayout("corner", "landscape");
    expect(screenToPitchDelta(0, -1, corner)).toEqual({ x: -1, y: 0 });
    expect(screenToPitchDelta(1, 0, corner)).toEqual({ x: 0, y: -1 });
  });

  it("clamps to the board and rounds to the centimetre", () => {
    expect(clampToBoard({ x: 200, y: -10 })).toEqual({
      x: BOARD_BOUNDS.maxX,
      y: BOARD_BOUNDS.minY,
    });
    expect(clampToBoard({ x: 50, y: 30 }, viewBounds("corner"))).toEqual({
      x: 23.9,
      y: 30,
    });
    expect(roundPoint({ x: 1.23456, y: 7.899 })).toEqual({ x: 1.23, y: 7.9 });
  });
});
