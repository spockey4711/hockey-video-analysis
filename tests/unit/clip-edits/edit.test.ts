import { describe, expect, it } from "vitest";

import {
  checkEditWindow,
  EMPTY_EDIT,
  isEmptyEdit,
  MAX_EDIT_JSON_LENGTH,
  MAX_MARKS,
  MAX_SLOW_RANGES,
  MAX_STROKE_POINTS,
  MAX_ZOOM_KEYS,
  parseClipEdit,
  parseSaveEditInput,
  type ClipEdit,
} from "@/features/clip-edits";

const arrow = {
  tool: "arrow",
  color: "red",
  width: "medium",
  style: "solid",
  points: [
    { x: 0.1, y: 0.2 },
    { x: 0.4, y: 0.5 },
  ],
};

function mark(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    atS: 105,
    holdS: 2,
    freeze: true,
    strokes: [arrow],
    ...overrides,
  };
}

/** A full, valid edit of a clip whose window is 100..112 s of game time. */
function edit(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    trim: { startS: 101, endS: 110 },
    slow: [{ startS: 103, endS: 105, rate: 0.5 }],
    zoom: [
      { atS: 102, rect: { x: 0, y: 0, w: 1 }, ease: "glide" },
      { atS: 104, rect: { x: 0.25, y: 0.3, w: 0.5 }, ease: "hold" },
    ],
    marks: [mark()],
    ...overrides,
  };
}

function parsed(value: unknown): ClipEdit {
  const result = parseClipEdit(value);
  if (!result.ok) throw new Error(`expected a valid edit: ${result.error}`);
  return result.value;
}

function refused(value: unknown): string {
  const result = parseClipEdit(value);
  if (result.ok) throw new Error("expected the edit to be refused");
  return result.error;
}

describe("parseClipEdit", () => {
  it("accepts a full edit and returns a clean copy", () => {
    const clean = parsed({ ...edit(), extra: "dropped" });
    expect(clean).toEqual(edit());
    expect(clean).not.toHaveProperty("extra");
  });

  it("reads an absent or null trim as the whole clip", () => {
    expect(parsed(edit({ trim: undefined })).trim).toBeNull();
    expect(parsed(edit({ trim: null })).trim).toBeNull();
  });

  it("accepts the empty edit", () => {
    expect(parsed(EMPTY_EDIT)).toEqual(EMPTY_EDIT);
  });

  it("refuses anything but a version 1 object", () => {
    expect(refused(null)).toMatch(/object/);
    expect(refused([])).toMatch(/object/);
    expect(refused(edit({ v: 2 }))).toMatch(/version 1/);
    expect(refused(edit({ v: undefined }))).toMatch(/version 1/);
  });

  it("keeps times to the millisecond and positions to a ten-thousandth", () => {
    const clean = parsed(
      edit({
        trim: { startS: 101.00049, endS: 109.9996 },
        zoom: [
          { atS: 102, rect: { x: 0.123456, y: 0.5, w: 0.3 }, ease: "hold" },
        ],
      }),
    );
    expect(clean.trim).toEqual({ startS: 101, endS: 110 });
    expect(clean.zoom[0].rect.x).toBe(0.1235);
  });

  describe("times", () => {
    it("refuses a time that is not a finite, non-negative number", () => {
      for (const bad of [-1, Number.NaN, Infinity, "101", null]) {
        expect(refused(edit({ trim: { startS: bad, endS: 110 } }))).toMatch(
          /trim.startS/,
        );
      }
    });

    it("refuses a reversed or too short trim", () => {
      expect(refused(edit({ trim: { startS: 110, endS: 101 } }))).toMatch(
        /end after/,
      );
      expect(refused(edit({ trim: { startS: 101, endS: 101.2 } }))).toMatch(
        /at least/,
      );
    });
  });

  describe("slow motion", () => {
    it("allows only the offered rates", () => {
      expect(
        parsed(edit({ slow: [{ startS: 103, endS: 104, rate: 0.25 }] })).slow,
      ).toHaveLength(1);
      for (const rate of [1, 0.75, 2, "0.5"]) {
        expect(
          refused(edit({ slow: [{ startS: 103, endS: 104, rate }] })),
        ).toMatch(/rate/);
      }
    });

    it("sorts ranges into play order and refuses overlaps, but not touching ranges", () => {
      const clean = parsed(
        edit({
          slow: [
            { startS: 106, endS: 107, rate: 0.5 },
            { startS: 103, endS: 106, rate: 0.25 },
          ],
        }),
      );
      expect(clean.slow.map((range) => range.startS)).toEqual([103, 106]);
      expect(
        refused(
          edit({
            slow: [
              { startS: 103, endS: 106, rate: 0.5 },
              { startS: 105, endS: 107, rate: 0.5 },
            ],
          }),
        ),
      ).toMatch(/overlap/);
    });

    it(`holds at most ${MAX_SLOW_RANGES} ranges`, () => {
      const slow = Array.from({ length: MAX_SLOW_RANGES + 1 }, (_, i) => ({
        startS: 100 + i,
        endS: 100.5 + i,
        rate: 0.5,
      }));
      expect(refused(edit({ slow }))).toMatch(/more than 10/);
      expect(parsed(edit({ slow: slow.slice(1) })).slow).toHaveLength(10);
    });
  });

  describe("zoom", () => {
    it("refuses a crop outside the picture or deeper than 5x", () => {
      const withRect = (rect: unknown) =>
        edit({ zoom: [{ atS: 102, rect, ease: "hold" }] });
      expect(refused(withRect({ x: 0.6, y: 0, w: 0.5 }))).toMatch(
        /inside the picture/,
      );
      expect(refused(withRect({ x: 0, y: 0.6, w: 0.5 }))).toMatch(
        /inside the picture/,
      );
      expect(refused(withRect({ x: 0, y: 0, w: 0.19 }))).toMatch(/at least/);
      expect(refused(withRect({ x: -0.1, y: 0, w: 0.5 }))).toMatch(/between/);
      expect(refused(withRect({ x: 0, y: 0, w: 1.2 }))).toMatch(/between/);
      expect(refused(withRect(null))).toMatch(/crop/);
    });

    it("keeps a crop flush with the edge inside the picture after rounding", () => {
      const [key] = parsed(
        edit({
          zoom: [
            {
              atS: 102,
              rect: { x: 0.66667, y: 0.5, w: 0.33333 },
              ease: "hold",
            },
          ],
        }),
      ).zoom;
      expect(key.rect.x + key.rect.w).toBeLessThanOrEqual(1);
    });

    it("refuses an unknown ease and keyframes at the same moment", () => {
      expect(
        refused(
          edit({
            zoom: [{ atS: 102, rect: { x: 0, y: 0, w: 1 }, ease: "bounce" }],
          }),
        ),
      ).toMatch(/ease/);
      const key = { atS: 102, rect: { x: 0, y: 0, w: 1 }, ease: "hold" };
      expect(refused(edit({ zoom: [key, key] }))).toMatch(/distinct/);
    });

    it(`holds at most ${MAX_ZOOM_KEYS} keyframes, sorted`, () => {
      const zoom = Array.from({ length: MAX_ZOOM_KEYS + 1 }, (_, i) => ({
        atS: 111 - i * 0.5,
        rect: { x: 0, y: 0, w: 1 },
        ease: "glide",
      }));
      expect(refused(edit({ zoom }))).toMatch(/more than 20/);
      const clean = parsed(edit({ zoom: zoom.slice(1) }));
      expect(clean.zoom.map((key) => key.atS)).toEqual(
        [...clean.zoom.map((key) => key.atS)].sort((a, b) => a - b),
      );
    });
  });

  describe("markers", () => {
    it("accepts every telestration tool with the right number of points", () => {
      const strokes = [
        arrow,
        { ...arrow, tool: "circle" },
        {
          ...arrow,
          tool: "freehand",
          points: [...arrow.points, { x: 1, y: 1 }],
        },
        { ...arrow, tool: "curve", style: "dotted" },
      ];
      expect(
        parsed(edit({ marks: [mark({ strokes })] })).marks[0].strokes,
      ).toHaveLength(4);
    });

    it("refuses a stroke with the wrong shape", () => {
      const withStroke = (stroke: unknown) =>
        edit({ marks: [mark({ strokes: [stroke] })] });
      expect(refused(withStroke({ ...arrow, tool: "text" }))).toMatch(/tool/);
      expect(refused(withStroke({ ...arrow, color: "green" }))).toMatch(
        /colour/,
      );
      expect(refused(withStroke({ ...arrow, width: "huge" }))).toMatch(/width/);
      expect(refused(withStroke({ ...arrow, style: "dashed" }))).toMatch(
        /style/,
      );
      expect(
        refused(
          withStroke({ ...arrow, points: [...arrow.points, { x: 0, y: 0 }] }),
        ),
      ).toMatch(/exactly two/);
      expect(
        refused(
          withStroke({ ...arrow, tool: "freehand", points: [{ x: 0, y: 0 }] }),
        ),
      ).toMatch(/at least two/);
      expect(
        refused(
          withStroke({
            ...arrow,
            points: [
              { x: 0, y: 0 },
              { x: 1.5, y: 0 },
            ],
          }),
        ),
      ).toMatch(/between 0 and 1/);
    });

    it(`holds at most ${MAX_STROKE_POINTS} points per stroke`, () => {
      const points = Array.from({ length: MAX_STROKE_POINTS + 1 }, (_, i) => ({
        x: (i % 100) / 100,
        y: 0.5,
      }));
      const freehand = { ...arrow, tool: "freehand", points };
      expect(refused(edit({ marks: [mark({ strokes: [freehand] })] }))).toMatch(
        /more than 2000/,
      );
    });

    it("refuses a marker without strokes, a bad id, a bad hold or a missing freeze flag", () => {
      expect(refused(edit({ marks: [mark({ strokes: [] })] }))).toMatch(
        /at least one stroke/,
      );
      expect(refused(edit({ marks: [mark({ id: "Mark 1" })] }))).toMatch(/id/);
      expect(refused(edit({ marks: [mark({ holdS: 0 })] }))).toMatch(/holdS/);
      expect(refused(edit({ marks: [mark({ holdS: 31 })] }))).toMatch(/holdS/);
      expect(refused(edit({ marks: [mark({ freeze: "yes" })] }))).toMatch(
        /freeze/,
      );
    });

    it("refuses duplicate ids and sorts markers into play order", () => {
      expect(refused(edit({ marks: [mark(), mark({ atS: 106 })] }))).toMatch(
        /unique/,
      );
      const clean = parsed(
        edit({
          marks: [mark({ id: "b", atS: 107 }), mark({ id: "a", atS: 104 })],
        }),
      );
      expect(clean.marks.map((m) => m.id)).toEqual(["a", "b"]);
    });

    it(`holds at most ${MAX_MARKS} markers`, () => {
      const marks = Array.from({ length: MAX_MARKS + 1 }, (_, i) =>
        mark({ id: `m${i}` }),
      );
      expect(refused(edit({ marks }))).toMatch(/more than 30/);
    });
  });

  it(`refuses an edit over ${MAX_EDIT_JSON_LENGTH / 1024} KiB`, () => {
    // 30 markers of 1000-point lines stay under every count cap but not the size cap.
    const points = Array.from({ length: 1000 }, (_, i) => ({
      x: (i % 97) / 97,
      y: (i % 89) / 89,
    }));
    const marks = Array.from({ length: MAX_MARKS }, (_, i) =>
      mark({ id: `m${i}`, strokes: [{ ...arrow, tool: "freehand", points }] }),
    );
    expect(refused(edit({ marks }))).toMatch(/KiB/);
  });
});

describe("isEmptyEdit", () => {
  it("is true only for an edit that changes nothing", () => {
    expect(isEmptyEdit(EMPTY_EDIT)).toBe(true);
    expect(isEmptyEdit(parsed(edit()))).toBe(false);
    expect(isEmptyEdit(parsed(edit({ slow: [], zoom: [], marks: [] })))).toBe(
      false,
    );
  });
});

describe("checkEditWindow", () => {
  const window = { startS: 100, endS: 112 };

  it("accepts an edit inside the clip window, edges included", () => {
    expect(checkEditWindow(parsed(edit()), window)).toBeNull();
    expect(
      checkEditWindow(
        parsed(edit({ trim: { startS: 100, endS: 112 } })),
        window,
      ),
    ).toBeNull();
  });

  it("names the part that reaches outside the window", () => {
    expect(
      checkEditWindow(
        parsed(edit({ trim: { startS: 99, endS: 110 } })),
        window,
      ),
    ).toMatch(/trim/);
    expect(
      checkEditWindow(
        parsed(edit({ slow: [{ startS: 111, endS: 113, rate: 0.5 }] })),
        window,
      ),
    ).toMatch(/slow-motion/);
    expect(
      checkEditWindow(
        parsed(
          edit({
            zoom: [{ atS: 99.5, rect: { x: 0, y: 0, w: 1 }, ease: "hold" }],
          }),
        ),
        window,
      ),
    ).toMatch(/zoom/);
    expect(
      checkEditWindow(parsed(edit({ marks: [mark({ atS: 113 })] })), window),
    ).toMatch(/marker/);
  });
});

describe("parseSaveEditInput", () => {
  it("reads the version and the edit", () => {
    expect(parseSaveEditInput({ version: 3, edit: edit() })).toEqual({
      ok: true,
      value: { version: 3, edit: edit() },
    });
  });

  it("stores a cleared or empty edit as null", () => {
    for (const cleared of [null, EMPTY_EDIT]) {
      expect(parseSaveEditInput({ version: 0, edit: cleared })).toEqual({
        ok: true,
        value: { version: 0, edit: null },
      });
    }
  });

  it("refuses a missing or malformed version", () => {
    for (const version of [undefined, -1, 1.5, "2"]) {
      expect(parseSaveEditInput({ version, edit: null }).ok).toBe(false);
    }
    expect(parseSaveEditInput("edit").ok).toBe(false);
  });

  it("passes on why an edit was refused", () => {
    expect(parseSaveEditInput({ version: 0, edit: edit({ v: 9 }) })).toEqual({
      ok: false,
      error: "an edit must be version 1",
    });
  });
});
