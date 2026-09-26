import { describe, expect, it } from "vitest";

import {
  editStateAt,
  EMPTY_EDIT,
  freezeCrossed,
  FULL_PICTURE,
  interpolateRect,
  MARK_SNAP_S,
  marksShownAt,
  parseClipEdit,
  toFileS,
  toGameS,
  toPlaybackPlan,
  zoomAt,
  type ClipEdit,
  type ClipMark,
  type PlaybackPlan,
  type ZoomKey,
} from "@/features/clip-edits";

/** A tag window of 100..112 s; the copy-cut file really starts at 98.7 s. */
const timeline = { cutStartS: 98.7, window: { startS: 100, endS: 112 } };

const stroke = {
  tool: "arrow" as const,
  color: "red" as const,
  width: "medium" as const,
  style: "solid" as const,
  points: [
    { x: 0.1, y: 0.1 },
    { x: 0.5, y: 0.5 },
  ],
};

function mark(overrides: Partial<ClipMark> = {}): ClipMark {
  return {
    id: "m1",
    atS: 105,
    holdS: 2,
    freeze: false,
    strokes: [stroke],
    ...overrides,
  };
}

function edit(overrides: Partial<ClipEdit> = {}): ClipEdit {
  const candidate = { ...EMPTY_EDIT, ...overrides };
  const result = parseClipEdit(candidate);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function plan(overrides: Partial<PlaybackPlan> = {}): PlaybackPlan {
  return {
    inS: 1,
    outS: 11,
    slow: [],
    zoom: [],
    marks: [],
    exact: true,
    trimClamped: false,
    ...overrides,
  };
}

describe("game time and clip-file time", () => {
  it("are one offset apart: the game time at file time 0", () => {
    expect(toFileS(105, 98.7)).toBeCloseTo(6.3, 9);
    expect(toGameS(6.3, 98.7)).toBeCloseTo(105, 9);
    expect(toGameS(toFileS(123.456, 98.7), 98.7)).toBeCloseTo(123.456, 9);
  });
});

describe("toPlaybackPlan", () => {
  it("plays the plain clip from the tag start, not the keyframe before it", () => {
    const result = toPlaybackPlan(null, timeline);
    expect(result.inS).toBeCloseTo(1.3, 9);
    expect(result.outS).toBeCloseTo(13.3, 9);
    expect(result).toMatchObject({
      slow: [],
      zoom: [],
      marks: [],
      exact: true,
      trimClamped: false,
    });
  });

  it("maps the trim, slow motion, zoom and markers onto the file's clock", () => {
    const result = toPlaybackPlan(
      edit({
        trim: { startS: 101, endS: 110 },
        slow: [{ startS: 103, endS: 105, rate: 0.5 }],
        zoom: [{ atS: 104, rect: { x: 0.25, y: 0.25, w: 0.5 }, ease: "hold" }],
        marks: [mark({ atS: 106 })],
      }),
      timeline,
    );
    expect(result.inS).toBeCloseTo(2.3, 9);
    expect(result.outS).toBeCloseTo(11.3, 9);
    expect(result.slow[0].startS).toBeCloseTo(4.3, 9);
    expect(result.slow[0].endS).toBeCloseTo(6.3, 9);
    expect(result.slow[0].rate).toBe(0.5);
    expect(result.zoom[0].atS).toBeCloseTo(5.3, 9);
    expect(result.marks[0].atS).toBeCloseTo(7.3, 9);
  });

  it("assumes the file starts at the tag while its real start is unknown", () => {
    const result = toPlaybackPlan(edit({ trim: { startS: 101, endS: 110 } }), {
      ...timeline,
      cutStartS: null,
    });
    expect(result).toMatchObject({ inS: 1, outS: 10, exact: false });
  });

  it("clamps a trim the clip window no longer holds, and says so", () => {
    // The tag was shortened to 100..108 after the edit was saved.
    const shortened = { ...timeline, window: { startS: 100, endS: 108 } };
    const partly = toPlaybackPlan(
      edit({ trim: { startS: 101, endS: 110 } }),
      shortened,
    );
    expect(partly.inS).toBeCloseTo(2.3, 9);
    expect(partly.outS).toBeCloseTo(9.3, 9);
    expect(partly.trimClamped).toBe(true);

    const wholly = toPlaybackPlan(
      edit({ trim: { startS: 109, endS: 111 } }),
      shortened,
    );
    expect(wholly.inS).toBeCloseTo(1.3, 9);
    expect(wholly.outS).toBeCloseTo(9.3, 9);
    expect(wholly.trimClamped).toBe(true);
  });

  it("never starts before the file does", () => {
    const result = toPlaybackPlan(null, { ...timeline, cutStartS: 100.2 });
    expect(result.inS).toBe(0);
  });

  it("cuts slow motion to the in and out point and drops what lies outside", () => {
    const result = toPlaybackPlan(
      edit({
        trim: { startS: 102, endS: 106 },
        slow: [
          { startS: 100, endS: 101, rate: 0.5 },
          { startS: 101, endS: 103, rate: 0.25 },
          { startS: 105, endS: 108, rate: 0.5 },
        ],
      }),
      { cutStartS: 100, window: timeline.window },
    );
    expect(result.slow).toEqual([
      { startS: 2, endS: 3, rate: 0.25 },
      { startS: 5, endS: 6, rate: 0.5 },
    ]);
  });

  it("keeps zoom keyframes outside the in and out point, which still shape the crop", () => {
    const result = toPlaybackPlan(
      edit({
        trim: { startS: 104, endS: 108 },
        zoom: [
          { atS: 102, rect: FULL_PICTURE, ease: "glide" },
          { atS: 110, rect: { x: 0.5, y: 0.5, w: 0.5 }, ease: "hold" },
        ],
      }),
      { cutStartS: 100, window: timeline.window },
    );
    expect(result.zoom.map((key) => key.atS)).toEqual([2, 10]);
  });

  it("keeps a marker only where it can show between the in and out point", () => {
    const result = toPlaybackPlan(
      edit({
        trim: { startS: 104, endS: 108 },
        marks: [
          mark({ id: "early", atS: 102, holdS: 1 }),
          mark({ id: "overlaps", atS: 103, holdS: 2 }),
          mark({ id: "frozenbefore", atS: 103.5, freeze: true }),
          mark({ id: "inside", atS: 106 }),
          mark({ id: "frozenatout", atS: 108, freeze: true }),
          mark({ id: "late", atS: 109 }),
        ],
      }),
      { cutStartS: 100, window: timeline.window },
    );
    expect(result.marks.map((m) => m.id)).toEqual([
      "overlaps",
      "inside",
      "frozenatout",
    ]);
  });
});

describe("zoomAt", () => {
  const zoomed = { x: 0.5, y: 0.5, w: 0.5 };
  const keys = (ease: "glide" | "hold"): ZoomKey[] => [
    { atS: 2, rect: FULL_PICTURE, ease },
    { atS: 4, rect: zoomed, ease: "hold" },
  ];

  it("shows the whole picture without keyframes", () => {
    expect(zoomAt([], 3)).toEqual(FULL_PICTURE);
  });

  it("holds one keyframe's crop for the whole clip", () => {
    const single: ZoomKey[] = [{ atS: 5, rect: zoomed, ease: "glide" }];
    expect(zoomAt(single, 0)).toEqual(zoomed);
    expect(zoomAt(single, 9)).toEqual(zoomed);
  });

  it("holds the first and last crops outside the keyframes", () => {
    expect(zoomAt(keys("glide"), 1)).toEqual(FULL_PICTURE);
    expect(zoomAt(keys("glide"), 6)).toEqual(zoomed);
  });

  it("holds the earlier crop until the next keyframe", () => {
    expect(zoomAt(keys("hold"), 3.99)).toEqual(FULL_PICTURE);
    expect(zoomAt(keys("hold"), 4)).toEqual(zoomed);
  });

  it("glides between keyframes, easing in and out", () => {
    const quarter = zoomAt(keys("glide"), 2.5);
    const half = zoomAt(keys("glide"), 3);
    // Halfway in time is halfway in the geometric zoom: 1 -> 0.5 gives 1/sqrt(2).
    expect(half.w).toBeCloseTo(Math.SQRT1_2, 9);
    // The ease-in means the first quarter covers less than a quarter of the way.
    expect(quarter.w).toBeGreaterThan(0.5 ** 0.25);
  });
});

describe("interpolateRect", () => {
  it("lands exactly on both ends", () => {
    const from = { x: 0, y: 0, w: 1 };
    const to = { x: 0.6, y: 0.1, w: 0.4 };
    expect(interpolateRect(from, to, 0)).toEqual(from);
    const end = interpolateRect(from, to, 1);
    expect(end.x).toBeCloseTo(0.6, 9);
    expect(end.y).toBeCloseTo(0.1, 9);
    expect(end.w).toBeCloseTo(0.4, 9);
  });

  it("moves the centre in a straight line and keeps the crop inside the picture", () => {
    const from = { x: 0, y: 0, w: 1 };
    const to = { x: 0.8, y: 0.8, w: 0.2 };
    for (let p = 0; p <= 1; p += 0.1) {
      const rect = interpolateRect(from, to, p);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(1 + 1e-12);
      expect(rect.y + rect.w).toBeLessThanOrEqual(1 + 1e-12);
    }
  });
});

describe("editStateAt", () => {
  const withEverything = plan({
    slow: [{ startS: 3, endS: 5, rate: 0.5 }],
    zoom: [{ atS: 4, rect: { x: 0.25, y: 0.25, w: 0.5 }, ease: "hold" }],
    marks: [
      mark({ id: "run", atS: 6, holdS: 2 }),
      mark({ id: "freeze", atS: 7, holdS: 2, freeze: true }),
    ],
  });

  it("plays the plain clip at normal speed on the whole picture", () => {
    expect(editStateAt(plan(), 5)).toEqual({
      rate: 1,
      zoom: FULL_PICTURE,
      marks: [],
      beforeIn: false,
      ended: false,
    });
  });

  it("slows down inside a range, from its start up to its end", () => {
    expect(editStateAt(withEverything, 2.99).rate).toBe(1);
    expect(editStateAt(withEverything, 3).rate).toBe(0.5);
    expect(editStateAt(withEverything, 4.99).rate).toBe(0.5);
    expect(editStateAt(withEverything, 5).rate).toBe(1);
  });

  it("applies the zoom crop", () => {
    expect(editStateAt(withEverything, 4.5).zoom).toEqual({
      x: 0.25,
      y: 0.25,
      w: 0.5,
    });
  });

  it("shows a running marker for its hold time, but never a freezing one", () => {
    expect(editStateAt(withEverything, 5.9).marks).toEqual([]);
    expect(editStateAt(withEverything, 6).marks.map((m) => m.id)).toEqual([
      "run",
    ]);
    expect(editStateAt(withEverything, 7.5).marks.map((m) => m.id)).toEqual([
      "run",
    ]);
    expect(editStateAt(withEverything, 8).marks).toEqual([]);
  });

  it("reports before the in point and at the out point", () => {
    expect(editStateAt(withEverything, 0.5).beforeIn).toBe(true);
    expect(editStateAt(withEverything, 1).beforeIn).toBe(false);
    expect(editStateAt(withEverything, 10.99).ended).toBe(false);
    expect(editStateAt(withEverything, 11).ended).toBe(true);
    expect(editStateAt(withEverything, 11.02).ended).toBe(true);
  });

  it("counts the frame showing the in point as on it, though it starts before", () => {
    // At 25 fps the frame a seek to 1 lands on can start at 0.96.
    expect(editStateAt(withEverything, 0.96).beforeIn).toBe(false);
    expect(editStateAt(withEverything, 0.9).beforeIn).toBe(true);
  });
});

describe("freezeCrossed", () => {
  const withFreezes = plan({
    marks: [
      mark({ id: "run", atS: 2 }),
      mark({ id: "atin", atS: 1, freeze: true }),
      mark({ id: "later", atS: 5, freeze: true }),
    ],
  });

  it("finds the freezing marker a frame stepped over", () => {
    expect(freezeCrossed(withFreezes, 4.98, 5.0)?.id).toBe("later");
    expect(freezeCrossed(withFreezes, 4.99, 5.01)?.id).toBe("later");
  });

  it("does not find it twice, nor a running marker", () => {
    expect(freezeCrossed(withFreezes, 5.0, 5.02)).toBeNull();
    expect(freezeCrossed(withFreezes, 1.98, 2.02)).toBeNull();
  });

  it("finds a marker on the in point from the first frame", () => {
    expect(freezeCrossed(withFreezes, -Infinity, 1.02)?.id).toBe("atin");
  });
});

describe("marksShownAt", () => {
  const withMarks = plan({
    marks: [
      mark({ id: "run", atS: 2, holdS: 3 }),
      mark({ id: "freeze", atS: 6, freeze: true }),
    ],
  });
  const ids = (t: number, heldId: string | null = null) =>
    marksShownAt(withMarks, t, heldId).map((m) => m.id);

  it("shows a running marker for its hold time", () => {
    expect(ids(1.99)).toEqual([]);
    expect(ids(2)).toEqual(["run"]);
    expect(ids(4.99)).toEqual(["run"]);
    expect(ids(5)).toEqual([]);
  });

  it("shows a freezing marker while the picture holds for it", () => {
    expect(ids(6.5, "freeze")).toEqual(["freeze"]);
    expect(ids(6.5)).toEqual([]);
  });

  it("shows a freezing marker on its own frame, not the next", () => {
    expect(ids(6)).toEqual(["freeze"]);
    expect(ids(6 + MARK_SNAP_S)).toEqual(["freeze"]);
    expect(ids(6.04)).toEqual([]);
  });
});
