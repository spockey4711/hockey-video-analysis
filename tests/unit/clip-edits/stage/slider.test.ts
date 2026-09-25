import { describe, expect, it } from "vitest";

import {
  formatClipTime,
  fractionAt,
  sliderKeyTarget,
} from "@/features/clip-edits/stage/slider";

describe("fractionAt", () => {
  const track = { left: 100, width: 200 };

  it("places a pointer along the track", () => {
    expect(fractionAt(100, track)).toBe(0);
    expect(fractionAt(150, track)).toBe(0.25);
    expect(fractionAt(300, track)).toBe(1);
  });

  it("clamps a pointer beyond either end", () => {
    expect(fractionAt(20, track)).toBe(0);
    expect(fractionAt(900, track)).toBe(1);
  });

  it("reads a track without width as its start", () => {
    expect(fractionAt(150, { left: 100, width: 0 })).toBe(0);
  });
});

describe("sliderKeyTarget", () => {
  const steps = { small: 1, large: 5 };
  const at = (key: string, shiftKey = false, value = 4) =>
    sliderKeyTarget(key, shiftKey, value, 0, 10, steps);

  it("steps with the arrow keys, further with Shift", () => {
    expect(at("ArrowRight")).toBe(5);
    expect(at("ArrowUp")).toBe(5);
    expect(at("ArrowLeft")).toBe(3);
    expect(at("ArrowDown")).toBe(3);
    expect(at("ArrowRight", true)).toBe(9);
  });

  it("takes the large step with Page Up and Page Down", () => {
    expect(at("PageUp")).toBe(9);
    expect(at("PageDown")).toBe(0);
  });

  it("jumps to the ends with Home and End", () => {
    expect(at("Home")).toBe(0);
    expect(at("End")).toBe(10);
  });

  it("stays inside the range", () => {
    expect(at("ArrowRight", true, 8)).toBe(10);
    expect(at("ArrowLeft", false, 0.5)).toBe(0);
  });

  it("leaves other keys alone", () => {
    expect(at("Enter")).toBeNull();
    expect(at("a")).toBeNull();
  });
});

describe("formatClipTime", () => {
  it("shows minutes, seconds and the nearest tenth", () => {
    expect(formatClipTime(0)).toBe("0:00,0");
    expect(formatClipTime(3.24)).toBe("0:03,2");
    expect(formatClipTime(8.694)).toBe("0:08,7");
    expect(formatClipTime(75.5)).toBe("1:15,5");
  });

  it("reads negative or broken times as zero", () => {
    expect(formatClipTime(-1)).toBe("0:00,0");
    expect(formatClipTime(Number.NaN)).toBe("0:00,0");
  });
});
