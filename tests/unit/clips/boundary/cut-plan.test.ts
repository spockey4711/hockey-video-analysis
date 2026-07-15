import { describe, expect, it } from "vitest";

import { planClipCut, type ClipSource } from "@/features/clips/boundary";

/**
 * The cut plan is the app-side of the shared worker contract (ADR 0002/0004): it
 * turns a tag's global clip window into the ordered per-file cuts the worker
 * copies and concatenates, splitting cleanly at chapter seams (P1-7, PRD s3
 * risk 2).
 */
describe("planClipCut", () => {
  // Three chapters, cumulative starts 0 / 100 / 250, total 400.
  const sources: ClipSource[] = [
    { orderIndex: 0, filePath: "GX01.mp4", durationS: 100 },
    { orderIndex: 1, filePath: "GX02.mp4", durationS: 150 },
    { orderIndex: 2, filePath: "GX03.mp4", durationS: 150 },
  ];

  it("plans a single-file cut for a window inside one chapter", () => {
    const plan = planClipCut(sources, 120, 200);
    expect(plan).toEqual({
      startS: 120,
      endS: 200,
      durationS: 80,
      spansBoundary: false,
      cuts: [
        {
          sourceIndex: 1,
          filePath: "GX02.mp4",
          localStartS: 20,
          localEndS: 100,
          durationS: 80,
        },
      ],
    });
  });

  it("plans one cut per file for a boundary-crossing window", () => {
    const plan = planClipCut(sources, 90, 120);
    expect(plan.spansBoundary).toBe(true);
    expect(plan.durationS).toBe(30);
    expect(plan.cuts).toEqual([
      {
        sourceIndex: 0,
        filePath: "GX01.mp4",
        localStartS: 90,
        localEndS: 100,
        durationS: 10,
      },
      {
        sourceIndex: 1,
        filePath: "GX02.mp4",
        localStartS: 0,
        localEndS: 20,
        durationS: 20,
      },
    ]);
  });

  it("sums the per-cut durations to the whole clip length", () => {
    const plan = planClipCut(sources, 50, 300);
    const total = plan.cuts.reduce((sum, cut) => sum + cut.durationS, 0);
    expect(total).toBe(plan.durationS);
    expect(plan.cuts.map((cut) => cut.filePath)).toEqual([
      "GX01.mp4",
      "GX02.mp4",
      "GX03.mp4",
    ]);
  });

  it("orders chapters by orderIndex before planning", () => {
    const shuffled: ClipSource[] = [sources[2], sources[0], sources[1]];
    const plan = planClipCut(shuffled, 90, 120);
    expect(plan.cuts.map((cut) => cut.filePath)).toEqual([
      "GX01.mp4",
      "GX02.mp4",
    ]);
  });

  it("throws for a non-contiguous chapter layout", () => {
    const gap: ClipSource[] = [
      { orderIndex: 0, filePath: "a.mp4", durationS: 100 },
      { orderIndex: 2, filePath: "c.mp4", durationS: 100 },
    ];
    expect(() => planClipCut(gap, 10, 50)).toThrow(RangeError);
  });

  it("throws for no sources", () => {
    expect(() => planClipCut([], 10, 50)).toThrow(RangeError);
  });

  it("throws for an empty or out-of-range window", () => {
    expect(() => planClipCut(sources, 100, 100)).toThrow(RangeError);
    expect(() => planClipCut(sources, 350, 500)).toThrow(RangeError);
  });
});
