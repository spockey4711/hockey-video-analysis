import { describe, expect, it } from "vitest";

import {
  clampToBoard,
  clientToPitch,
  fromView,
  roundPoint,
  screenToPitchDelta,
  toView,
  viewMatrix,
  viewSize,
  type Orientation,
} from "@/features/tactics/geometry";
import { BOARD_BOUNDS, CENTRE } from "@/features/tactics/pitch";

const ORIENTATIONS: Orientation[] = ["landscape", "portrait"];

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
    expect(viewSize("landscape")).toEqual({ width: 97.4, height: 59 });
    expect(viewSize("portrait")).toEqual({ width: 59, height: 97.4 });
  });

  it("puts the left goal on the left in landscape and at the bottom in portrait", () => {
    expect(toView({ x: 0, y: 27.5 }, "landscape")).toEqual({ u: 3, v: 29.5 });
    expect(toView({ x: 0, y: 27.5 }, "portrait")).toEqual({ u: 29.5, v: 94.4 });
  });

  it.each(ORIENTATIONS)("round-trips points in %s", (orientation) => {
    const point = { x: 12.5, y: 40 };
    const { u, v } = toView(point, orientation);
    expect(fromView(u, v, orientation)).toEqual(point);
  });

  it.each(ORIENTATIONS)(
    "draws with the same transform it maps pointers with in %s",
    (orientation) => {
      const point = { x: 70, y: 5 };
      expect(applyMatrix(viewMatrix(orientation), point.x, point.y)).toEqual(
        toView(point, orientation),
      );
    },
  );
});

describe("clientToPitch", () => {
  it("maps a pointer on a box of the board's shape", () => {
    // 974 x 590 px: ten pixels per metre, board origin at the box's corner.
    const box = { left: 100, top: 50, width: 974, height: 590 };
    const at = clientToPitch(100 + 487, 50 + 295, box, "landscape");
    expect(at.x).toBeCloseTo(CENTRE.x);
    expect(at.y).toBeCloseTo(CENTRE.y);
  });

  it("accounts for the letterbox when the box is wider than the board", () => {
    // Twice as wide as needed: the board is centred with bars left and right.
    const box = { left: 0, top: 0, width: 1948, height: 590 };
    const at = clientToPitch(487 + 30, 20, box, "landscape");
    expect(at.x).toBeCloseTo(0);
    expect(at.y).toBeCloseTo(0);
  });

  it("maps through the quarter turn in portrait", () => {
    const box = { left: 0, top: 0, width: 590, height: 974 };
    // Bottom middle of the portrait view is the left end of the pitch.
    const at = clientToPitch(295, 974 - 30, box, "portrait");
    expect(at.x).toBeCloseTo(0);
    expect(at.y).toBeCloseTo(CENTRE.y);
  });

  it("clamps a pointer off the board onto its edge", () => {
    const box = { left: 0, top: 0, width: 974, height: 590 };
    expect(clientToPitch(-500, 5000, box, "landscape")).toEqual({
      x: BOARD_BOUNDS.minX,
      y: BOARD_BOUNDS.maxY,
    });
  });
});

describe("helpers", () => {
  it("turns an arrow key into the pitch move that points the same way on screen", () => {
    expect(screenToPitchDelta(1, 0, "landscape")).toEqual({ x: 1, y: 0 });
    // Portrait: screen right is towards the bottom side-line, screen up
    // towards the right goal.
    expect(screenToPitchDelta(1, 0, "portrait")).toEqual({ x: 0, y: 1 });
    expect(screenToPitchDelta(0, -1, "portrait")).toEqual({ x: 1, y: 0 });
  });

  it("clamps to the board and rounds to the centimetre", () => {
    expect(clampToBoard({ x: 200, y: -10 })).toEqual({
      x: BOARD_BOUNDS.maxX,
      y: BOARD_BOUNDS.minY,
    });
    expect(roundPoint({ x: 1.23456, y: 7.899 })).toEqual({ x: 1.23, y: 7.9 });
  });
});
