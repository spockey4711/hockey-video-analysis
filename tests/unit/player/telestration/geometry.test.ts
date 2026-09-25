import { describe, expect, it } from "vitest";

import {
  containRect,
  curveHeadTail,
  curveThrough,
  dashPattern,
  DOT_HALO_SIZE,
  DOT_SIZE,
  DOT_SPACING,
  penWidth,
  toPicturePoint,
  toPixel,
} from "@/features/player/telestration/geometry";

describe("containRect", () => {
  it("pillarboxes a 16:9 picture in a wider box", () => {
    expect(containRect(2000, 900, 1600, 900)).toEqual({
      x: 200,
      y: 0,
      width: 1600,
      height: 900,
    });
  });

  it("letterboxes a 16:9 picture in a taller box", () => {
    expect(containRect(1600, 1200, 1920, 1080)).toEqual({
      x: 0,
      y: 150,
      width: 1600,
      height: 900,
    });
  });

  it("covers the whole box while the media size is unknown", () => {
    expect(containRect(800, 600, 0, 0)).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });
  });
});

describe("picture coordinates", () => {
  const picture = { x: 200, y: 0, width: 1600, height: 900 };

  it("normalizes a position on the picture", () => {
    expect(toPicturePoint(1000, 450, picture)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("clamps a position on the letterbox bars to the picture edge", () => {
    expect(toPicturePoint(50, 1000, picture)).toEqual({ x: 0, y: 1 });
  });

  it("lands on the same spot of a differently sized picture", () => {
    const point = toPicturePoint(600, 225, picture);
    expect(toPixel(point, { x: 0, y: 0, width: 3840, height: 2160 })).toEqual({
      x: 960,
      y: 540,
    });
  });
});

describe("penWidth", () => {
  it("scales with the picture so the export matches the screen", () => {
    expect(penWidth(3840) / penWidth(1280)).toBeCloseTo(3);
  });

  it("never gets thinner than two pixels", () => {
    expect(penWidth(100)).toBe(2);
  });

  it("draws medium by default and orders the steps thin < medium < thick", () => {
    expect(penWidth(1280)).toBe(penWidth(1280, "medium"));
    expect(penWidth(1280, "thin")).toBeLessThan(penWidth(1280));
    expect(penWidth(1280, "thick")).toBeGreaterThan(penWidth(1280));
  });

  it("keeps each step's ratio at every picture size", () => {
    for (const pictureWidth of [100, 1280, 3840]) {
      expect(
        penWidth(pictureWidth, "thin") / penWidth(pictureWidth),
      ).toBeCloseTo(0.5);
      expect(
        penWidth(pictureWidth, "thick") / penWidth(pictureWidth),
      ).toBeCloseTo(1.6);
    }
  });
});

describe("dashPattern", () => {
  it("draws round dots, spaced in pen widths", () => {
    expect(dashPattern(4)).toEqual([0, 4 * DOT_SPACING]);
  });

  it("scales the spacing with the pen, so every width keeps its rhythm", () => {
    const thin = penWidth(1280, "thin");
    const thick = penWidth(1280, "thick");
    const ratio = (width: number) => dashPattern(width)[1] / width;
    expect(ratio(thin)).toBeCloseTo(ratio(thick));
    expect(dashPattern(thick)[1]).toBeGreaterThan(dashPattern(thin)[1]);
  });

  it("leaves a clear gap between the halos of two neighbouring dots", () => {
    expect(DOT_SPACING).toBeGreaterThan(DOT_HALO_SIZE);
  });

  it("keeps a dark rim around each dot, but slimmer than the dot", () => {
    expect(DOT_HALO_SIZE).toBeGreaterThan(DOT_SIZE);
    expect((DOT_HALO_SIZE - DOT_SIZE) / 2).toBeLessThan(DOT_SIZE / 2);
  });
});

describe("curveThrough", () => {
  /** A point on the quadratic Bezier at parameter `t`. */
  function at(curve: NonNullable<ReturnType<typeof curveThrough>>, t: number) {
    const u = 1 - t;
    const { start, control, end } = curve;
    return {
      x: u * u * start.x + 2 * t * u * control.x + t * t * end.x,
      y: u * u * start.y + 2 * t * u * control.y + t * t * end.y,
    };
  }

  it("bends a symmetric drag through its bulge at the middle", () => {
    const curve = curveThrough([
      { x: 0.2, y: 0.6 },
      { x: 0.4, y: 0.4 },
      { x: 0.6, y: 0.6 },
    ]);
    expect(curve?.control.x).toBeCloseTo(0.4);
    expect(curve?.control.y).toBeCloseTo(0.2);
    const middle = at(curve!, 0.5);
    expect(middle.x).toBeCloseTo(0.4);
    expect(middle.y).toBeCloseTo(0.4);
  });

  it("passes through an off-centre bulge where the drag put it", () => {
    const through = { x: 0.3, y: 0.3 };
    const curve = curveThrough([
      { x: 0.2, y: 0.5 },
      { x: 0.25, y: 0.35 },
      through,
      { x: 0.6, y: 0.45 },
      { x: 0.7, y: 0.5 },
    ])!;
    // The bulge projects a fifth of the way along the chord.
    const point = at(curve, 0.2);
    expect(point.x).toBeCloseTo(through.x);
    expect(point.y).toBeCloseTo(through.y);
  });

  it("stays straight for a straight drag", () => {
    const curve = curveThrough([
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.3 },
      { x: 0.5, y: 0.5 },
    ]);
    expect(curve?.control.x).toBeCloseTo(0.3);
    expect(curve?.control.y).toBeCloseTo(0.3);
  });

  it("gives the same curve back from its start, bulge and end", () => {
    const drag = [
      { x: 0.1, y: 0.5 },
      { x: 0.2, y: 0.32 },
      { x: 0.3, y: 0.3 },
      { x: 0.45, y: 0.4 },
      { x: 0.5, y: 0.6 },
    ];
    const curve = curveThrough(drag);
    const again = curveThrough([drag[0]!, drag[2]!, drag[4]!]);
    expect(again?.control.x).toBeCloseTo(curve!.control.x);
    expect(again?.control.y).toBeCloseTo(curve!.control.y);
  });

  it("has no curve without points", () => {
    expect(curveThrough([])).toBeNull();
  });
});

describe("curveHeadTail", () => {
  it("points the head along the end tangent, from the control point", () => {
    const curve = {
      start: { x: 0.1, y: 0.5 },
      control: { x: 0.3, y: 0.1 },
      end: { x: 0.5, y: 0.5 },
    };
    expect(curveHeadTail(curve)).toEqual(curve.control);
  });

  it("falls back to the start when the control point sits on the end", () => {
    const curve = {
      start: { x: 0.1, y: 0.5 },
      control: { x: 0.5, y: 0.5 },
      end: { x: 0.5, y: 0.5 },
    };
    expect(curveHeadTail(curve)).toEqual(curve.start);
  });
});
