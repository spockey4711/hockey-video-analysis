import { describe, expect, it } from "vitest";

import {
  BOARD_BOUNDS,
  BOUNDARY,
  BROKEN_LINE_DASH,
  BROKEN_LINE_GAP,
  BROKEN_LINE_HALF_LENGTH,
  brokenLineDashCentres,
  brokenLinePoint,
  CENTRE,
  CIRCLE_RADIUS,
  goalRects,
  LINE_WIDTH,
  PITCH_LENGTH,
  PITCH_WIDTH,
  pitchMarkings,
} from "@/features/tactics/pitch";

// The FIH Rules of Hockey (2026), Field and Equipment Specifications: these
// tests pin the geometry to the published numbers, so a typo cannot move a
// line on the board.
describe("pitch constants", () => {
  it("matches the FIH field of 91.40 m by 55.00 m with 75 mm lines", () => {
    expect(PITCH_LENGTH).toBe(91.4);
    expect(PITCH_WIDTH).toBe(55);
    expect(LINE_WIDTH).toBe(0.075);
    expect(CENTRE).toEqual({ x: 45.7, y: 27.5 });
  });

  it("reaches into the minimum run-off of 3 m at the ends and 2 m at the sides", () => {
    expect(BOARD_BOUNDS).toEqual({
      minX: -3,
      minY: -2,
      maxX: 94.4,
      maxY: 57,
    });
  });

  it("draws the boundary on the line centres inside the outer edges", () => {
    expect(BOUNDARY.x).toBeCloseTo(0.0375);
    expect(BOUNDARY.x + BOUNDARY.width).toBeCloseTo(PITCH_LENGTH - 0.0375);
  });

  it("places the goals behind the back-lines, 3.66 m between the posts", () => {
    const [left, right] = goalRects();
    expect(left).toMatchObject({ x: -1.2, w: 1.2 });
    expect(right).toMatchObject({ x: PITCH_LENGTH, w: 1.2 });
    // Inner width 3.66 m plus two 50 mm posts.
    expect(left?.h).toBeCloseTo(3.76);
    expect(left?.y).toBeCloseTo(CENTRE.y - 1.88);
  });
});

describe("pitch markings", () => {
  const paths = pitchMarkings().flatMap((marking) =>
    marking.kind === "path" ? [marking.d] : [],
  );
  const spots = pitchMarkings().flatMap((marking) =>
    marking.kind === "spot" ? [marking.at] : [],
  );

  it("draws the centre-line and both 23 m lines to their far edge", () => {
    expect(paths).toContain("M45.7 0L45.7 55");
    expect(paths).toContain("M22.8625 0L22.8625 55");
    expect(paths).toContain("M68.5375 0L68.5375 55");
  });

  it("puts the penalty spots 6.475 m out from the goal-lines and a centre spot", () => {
    expect(spots).toEqual([
      CENTRE,
      { x: 6.475, y: 27.5 },
      { x: PITCH_LENGTH - 6.475, y: 27.5 },
    ]);
  });

  it("runs the circle 14.63 m out to its outer edge, round the posts", () => {
    // Line centre 14.5925 m out; posts' inner edges 1.83 m either side of 27.5.
    expect(paths).toContain(
      "M0 11.0775A14.5925 14.5925 0 0 1 14.5925 25.67L14.5925 29.33A14.5925 14.5925 0 0 1 0 43.9225",
    );
    expect(CIRCLE_RADIUS).toBe(14.63);
  });

  it("marks the side-lines 14.63 m from the back-lines and the back-lines 5 m and 10 m from the posts", () => {
    expect(paths).toContain("M14.5925 0L14.5925 -0.3");
    // Outer post edge 1.88 m from the centre, plus 5 m, less half a line.
    expect(paths).toContain(`M0 ${27.5 - 6.8425}L-0.3 ${27.5 - 6.8425}`);
    expect(paths).toContain(`M0 ${27.5 + 11.8425}L-0.3 ${27.5 + 11.8425}`);
  });
});

describe("broken line", () => {
  const r = CIRCLE_RADIUS + 5 - 0.0375;

  it("sits 5 m outside the circle-line", () => {
    expect(brokenLinePoint(1, 0)).toEqual({ x: r, y: CENTRE.y });
    const end = brokenLinePoint(1, BROKEN_LINE_HALF_LENGTH);
    expect(end.x).toBeCloseTo(0);
    expect(end.y).toBeCloseTo(CENTRE.y + 1.83 + r);
  });

  it("mirrors onto the right end", () => {
    expect(brokenLinePoint(-1, 0)).toEqual({
      x: PITCH_LENGTH - r,
      y: CENTRE.y,
    });
  });

  it("starts with a solid section on the top centre, then one every 3.30 m", () => {
    const centres = brokenLineDashCentres();
    expect(centres).toContain(0);
    const step = BROKEN_LINE_DASH + BROKEN_LINE_GAP;
    expect(centres.filter((s) => s > 0)[0]).toBeCloseTo(step);
    expect(Math.max(...centres) + BROKEN_LINE_DASH / 2).toBeLessThanOrEqual(
      BROKEN_LINE_HALF_LENGTH,
    );
    expect(centres).toEqual([...centres].sort((a, b) => a - b));
  });
});
