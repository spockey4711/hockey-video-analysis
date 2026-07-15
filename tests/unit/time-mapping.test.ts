import { describe, expect, it } from "vitest";

import {
  type SourcePoint,
  toGameTime,
  toSourcePoint,
  totalDurationS,
} from "@/lib/time-mapping";

/**
 * The mapping is shared verbatim with the pipeline worker (ADR 0002), so these
 * tests pin the contract - especially the chapter-boundary semantics, where the
 * ADR warns off-by-one bugs would otherwise creep in across components.
 */
describe("game-time mapping", () => {
  // Three chapters, cumulative starts 0 / 100 / 250, total 400.
  const durations = [100, 150, 150];

  describe("totalDurationS", () => {
    it("sums the chapter durations", () => {
      expect(totalDurationS(durations)).toBe(400);
      expect(totalDurationS([42.5])).toBe(42.5);
    });

    it("rejects an empty layout", () => {
      expect(() => totalDurationS([])).toThrow(RangeError);
    });
  });

  describe("toSourcePoint", () => {
    it("maps offsets inside a chapter to a local offset", () => {
      expect(toSourcePoint(durations, 0)).toEqual({
        sourceIndex: 0,
        localOffsetS: 0,
      });
      expect(toSourcePoint(durations, 40)).toEqual({
        sourceIndex: 0,
        localOffsetS: 40,
      });
      expect(toSourcePoint(durations, 120)).toEqual({
        sourceIndex: 1,
        localOffsetS: 20,
      });
      expect(toSourcePoint(durations, 300)).toEqual({
        sourceIndex: 2,
        localOffsetS: 50,
      });
    });

    it("puts an interior boundary at the start of the next chapter", () => {
      // 100 is the seam between chapter 0 and 1: playback continues into 1@0.
      expect(toSourcePoint(durations, 100)).toEqual({
        sourceIndex: 1,
        localOffsetS: 0,
      });
      expect(toSourcePoint(durations, 250)).toEqual({
        sourceIndex: 2,
        localOffsetS: 0,
      });
    });

    it("maps the exact game end to the end of the last chapter", () => {
      expect(toSourcePoint(durations, 400)).toEqual({
        sourceIndex: 2,
        localOffsetS: 150,
      });
    });

    it("handles a single-chapter game", () => {
      expect(toSourcePoint([90], 30)).toEqual({
        sourceIndex: 0,
        localOffsetS: 30,
      });
      expect(toSourcePoint([90], 90)).toEqual({
        sourceIndex: 0,
        localOffsetS: 90,
      });
    });

    it("throws for offsets outside [0, total]", () => {
      expect(() => toSourcePoint(durations, -1)).toThrow(RangeError);
      expect(() => toSourcePoint(durations, 400.5)).toThrow(RangeError);
      expect(() => toSourcePoint(durations, Number.NaN)).toThrow(RangeError);
      expect(() => toSourcePoint(durations, Number.POSITIVE_INFINITY)).toThrow(
        RangeError,
      );
    });
  });

  describe("toGameTime", () => {
    it("maps a local offset back to global game time", () => {
      expect(toGameTime(durations, { sourceIndex: 0, localOffsetS: 40 })).toBe(
        40,
      );
      expect(toGameTime(durations, { sourceIndex: 1, localOffsetS: 20 })).toBe(
        120,
      );
      expect(toGameTime(durations, { sourceIndex: 2, localOffsetS: 50 })).toBe(
        300,
      );
    });

    it("accepts a local offset at the exact chapter end", () => {
      // A boundary-crossing / game-ending clip point sits at the chapter's end.
      expect(toGameTime(durations, { sourceIndex: 0, localOffsetS: 100 })).toBe(
        100,
      );
      expect(toGameTime(durations, { sourceIndex: 2, localOffsetS: 150 })).toBe(
        400,
      );
    });

    it("throws for an unknown chapter index", () => {
      expect(() =>
        toGameTime(durations, { sourceIndex: 3, localOffsetS: 0 }),
      ).toThrow(RangeError);
      expect(() =>
        toGameTime(durations, { sourceIndex: -1, localOffsetS: 0 }),
      ).toThrow(RangeError);
      expect(() =>
        toGameTime(durations, { sourceIndex: 0.5, localOffsetS: 0 }),
      ).toThrow(RangeError);
    });

    it("throws for a local offset outside the chapter", () => {
      expect(() =>
        toGameTime(durations, { sourceIndex: 0, localOffsetS: 100.5 }),
      ).toThrow(RangeError);
      expect(() =>
        toGameTime(durations, { sourceIndex: 1, localOffsetS: -1 }),
      ).toThrow(RangeError);
    });
  });

  describe("round trip", () => {
    it("is a stable inverse for interior offsets across every chapter", () => {
      for (let gameTimeS = 0; gameTimeS < 400; gameTimeS += 0.5) {
        const point: SourcePoint = toSourcePoint(durations, gameTimeS);
        expect(toGameTime(durations, point)).toBeCloseTo(gameTimeS, 10);
      }
    });

    it("survives fractional durations without drift", () => {
      const fractional = [12.34, 56.78, 90.12];
      const total = totalDurationS(fractional);
      const point = toSourcePoint(fractional, total);
      expect(toGameTime(fractional, point)).toBeCloseTo(total, 10);
    });
  });
});
