import { describe, expect, it } from "vitest";

import {
  toGameTime,
  toSourceSegments,
  windowCrossesBoundary,
} from "@/lib/time-mapping";

/**
 * The window-splitting rule is shared verbatim with the pipeline worker (ADR
 * 0002), so these tests pin the contract - especially the seam behaviour, where
 * a boundary-crossing clip must be split into one segment per file rather than
 * clamped at the chapter edge (PRD s3 risk 2).
 */
describe("toSourceSegments", () => {
  // Three chapters, cumulative starts 0 / 100 / 250, total 400.
  const durations = [100, 150, 150];

  it("keeps a window inside one chapter as a single segment", () => {
    expect(toSourceSegments(durations, 20, 80)).toEqual([
      { sourceIndex: 0, localStartS: 20, localEndS: 80 },
    ]);
    expect(toSourceSegments(durations, 120, 200)).toEqual([
      { sourceIndex: 1, localStartS: 20, localEndS: 100 },
    ]);
  });

  it("splits a window that crosses a chapter seam into one segment per file", () => {
    // 90..120 straddles the 100 seam: 90..100 of chapter 0, then 0..20 of 1.
    expect(toSourceSegments(durations, 90, 120)).toEqual([
      { sourceIndex: 0, localStartS: 90, localEndS: 100 },
      { sourceIndex: 1, localStartS: 0, localEndS: 20 },
    ]);
  });

  it("splits a window spanning three chapters into three segments", () => {
    expect(toSourceSegments(durations, 50, 300)).toEqual([
      { sourceIndex: 0, localStartS: 50, localEndS: 100 },
      { sourceIndex: 1, localStartS: 0, localEndS: 150 },
      { sourceIndex: 2, localStartS: 0, localEndS: 50 },
    ]);
  });

  it("does not spill a zero-length segment when the end lands on a seam", () => {
    // Ends exactly at 100: chapter 0 up to its exclusive end, nothing in 1.
    expect(toSourceSegments(durations, 40, 100)).toEqual([
      { sourceIndex: 0, localStartS: 40, localEndS: 100 },
    ]);
  });

  it("starts at the next chapter when the start lands on a seam", () => {
    // Starts exactly at 100: half-open rule puts it at chapter 1, offset 0.
    expect(toSourceSegments(durations, 100, 180)).toEqual([
      { sourceIndex: 1, localStartS: 0, localEndS: 80 },
    ]);
  });

  it("covers the whole game as every chapter end-to-end", () => {
    expect(toSourceSegments(durations, 0, 400)).toEqual([
      { sourceIndex: 0, localStartS: 0, localEndS: 100 },
      { sourceIndex: 1, localStartS: 0, localEndS: 150 },
      { sourceIndex: 2, localStartS: 0, localEndS: 150 },
    ]);
  });

  it("reaches the exact game end as the last chapter's exclusive end", () => {
    expect(toSourceSegments(durations, 380, 400)).toEqual([
      { sourceIndex: 2, localStartS: 130, localEndS: 150 },
    ]);
  });

  it("handles a single-chapter game", () => {
    expect(toSourceSegments([90], 10, 90)).toEqual([
      { sourceIndex: 0, localStartS: 10, localEndS: 90 },
    ]);
  });

  it("throws for an empty or reversed window", () => {
    expect(() => toSourceSegments(durations, 100, 100)).toThrow(RangeError);
    expect(() => toSourceSegments(durations, 120, 80)).toThrow(RangeError);
  });

  it("throws for a window outside [0, total]", () => {
    expect(() => toSourceSegments(durations, -1, 50)).toThrow(RangeError);
    expect(() => toSourceSegments(durations, 350, 400.5)).toThrow(RangeError);
    expect(() => toSourceSegments(durations, Number.NaN, 50)).toThrow(
      RangeError,
    );
    expect(() =>
      toSourceSegments(durations, 0, Number.POSITIVE_INFINITY),
    ).toThrow(RangeError);
  });

  it("throws for an invalid chapter layout", () => {
    expect(() => toSourceSegments([], 0, 10)).toThrow(RangeError);
    expect(() => toSourceSegments([0], 0, 10)).toThrow(RangeError);
  });

  it("splits a fractional-duration boundary without drift", () => {
    const fractional = [12.34, 56.78, 90.12];
    const segments = toSourceSegments(fractional, 10, 80);
    // Each segment maps back to a contiguous global run covering [10, 80].
    const start0 = toGameTime(fractional, {
      sourceIndex: segments[0].sourceIndex,
      localOffsetS: segments[0].localStartS,
    });
    const last = segments[segments.length - 1];
    const endLast = toGameTime(fractional, {
      sourceIndex: last.sourceIndex,
      localOffsetS: last.localEndS,
    });
    expect(start0).toBeCloseTo(10, 10);
    expect(endLast).toBeCloseTo(80, 10);
    // Total covered length equals the window length.
    const covered = segments.reduce(
      (sum, seg) => sum + (seg.localEndS - seg.localStartS),
      0,
    );
    expect(covered).toBeCloseTo(70, 10);
  });
});

describe("windowCrossesBoundary", () => {
  const durations = [100, 150, 150];

  it("is false for a single-chapter window", () => {
    expect(windowCrossesBoundary(durations, 20, 80)).toBe(false);
    expect(windowCrossesBoundary(durations, 40, 100)).toBe(false);
  });

  it("is true for a window that straddles a seam", () => {
    expect(windowCrossesBoundary(durations, 90, 120)).toBe(true);
    expect(windowCrossesBoundary(durations, 50, 300)).toBe(true);
  });
});
