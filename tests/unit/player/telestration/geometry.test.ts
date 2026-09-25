import { describe, expect, it } from "vitest";

import {
  containRect,
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
