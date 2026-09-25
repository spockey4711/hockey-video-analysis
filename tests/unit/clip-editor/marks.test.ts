import { describe, expect, it } from "vitest";

import {
  compactStroke,
  DEFAULT_MARK_SETTINGS,
  newMarkId,
  putMark,
  removeMark,
  setMarkSettings,
  withMarks,
} from "@/features/clip-editor/marks";
import {
  type ClipMark,
  EMPTY_EDIT,
  MAX_HOLD_S,
  MAX_MARKS,
  MAX_STROKE_POINTS,
  MIN_HOLD_S,
  parseClipEdit,
} from "@/features/clip-edits";
import type { Stroke } from "@/features/player/telestration/state";

const window = { startS: 100, endS: 112 };

const stroke: Stroke = {
  tool: "arrow",
  color: "red",
  width: "medium",
  style: "solid",
  points: [
    { x: 0.1, y: 0.1 },
    { x: 0.5, y: 0.5 },
  ],
};

function mark(overrides: Partial<ClipMark> = {}): ClipMark {
  return {
    id: "a",
    atS: 104,
    ...DEFAULT_MARK_SETTINGS,
    strokes: [stroke],
    ...overrides,
  };
}

describe("DEFAULT_MARK_SETTINGS", () => {
  it("freezes the picture for a few seconds (D6)", () => {
    expect(DEFAULT_MARK_SETTINGS.freeze).toBe(true);
    expect(DEFAULT_MARK_SETTINGS.holdS).toBeGreaterThanOrEqual(2);
  });
});

describe("newMarkId", () => {
  it("gives a short lowercase id the edit document accepts", () => {
    expect(newMarkId([], () => 0.123456789)).toMatch(/^[a-z0-9]{1,12}$/);
  });

  it("never repeats an id already taken", () => {
    const taken = newMarkId([], () => 0.5);
    const next = newMarkId([mark({ id: taken })], () => 0.5);
    expect(next).not.toBe(taken);
    expect(next).toMatch(/^[a-z0-9]{1,12}$/);
  });
});

describe("compactStroke", () => {
  it("keeps positions to a ten-thousandth, inside the picture", () => {
    const kept = compactStroke({
      ...stroke,
      points: [
        { x: 0.123456, y: -0.2 },
        { x: 1.3, y: 0.654321 },
      ],
    });
    expect(kept.points).toEqual([
      { x: 0.1235, y: 0 },
      { x: 1, y: 0.6543 },
    ]);
  });

  it("thins a long line to the most points a stroke may hold, keeping its ends", () => {
    const points = Array.from(
      { length: MAX_STROKE_POINTS * 2 + 1 },
      (_, i) => ({
        x: i / (MAX_STROKE_POINTS * 2),
        y: 0.5,
      }),
    );
    const kept = compactStroke({ ...stroke, tool: "freehand", points });
    expect(kept.points).toHaveLength(MAX_STROKE_POINTS);
    expect(kept.points[0]).toEqual({ x: 0, y: 0.5 });
    expect(kept.points.at(-1)).toEqual({ x: 1, y: 0.5 });
  });
});

describe("putMark", () => {
  it("adds a marker in play order", () => {
    const next = putMark(
      [mark({ id: "a", atS: 104 }), mark({ id: "c", atS: 108 })],
      mark({ id: "b", atS: 106 }),
      window,
    );
    expect(next?.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("changes the stored marker with the same id in place", () => {
    const next = putMark(
      [mark({ id: "a" }), mark({ id: "b", atS: 106 })],
      mark({ id: "a", freeze: false, holdS: 5 }),
      window,
    );
    expect(next).toHaveLength(2);
    expect(next?.[0]).toMatchObject({ id: "a", freeze: false, holdS: 5 });
  });

  it("keeps its moment inside the window and its hold time in bounds", () => {
    expect(putMark([], mark({ atS: 99, holdS: 0 }), window)?.[0]).toMatchObject(
      { atS: 100, holdS: MIN_HOLD_S },
    );
    expect(
      putMark([], mark({ atS: 113, holdS: 99 }), window)?.[0],
    ).toMatchObject({ atS: 112, holdS: MAX_HOLD_S });
  });

  it("allows no new marker past the limit, but still a change", () => {
    const full = Array.from({ length: MAX_MARKS }, (_, i) =>
      mark({ id: `m${i}` }),
    );
    expect(putMark(full, mark({ id: "new" }), window)).toBeNull();
    expect(putMark(full, mark({ id: "m3", holdS: 5 }), window)).toHaveLength(
      MAX_MARKS,
    );
  });
});

describe("marker settings and removal", () => {
  const marks = [mark({ id: "a" }), mark({ id: "b", atS: 106 })];

  it("sets the hold time and freeze-or-run of one marker only", () => {
    const next = setMarkSettings(marks, "b", { holdS: 8, freeze: false });
    expect(next[0]).toEqual(marks[0]);
    expect(next[1]).toMatchObject({ holdS: 8, freeze: false });
  });

  it("removes a marker by id", () => {
    expect(removeMark(marks, "a").map((m) => m.id)).toEqual(["b"]);
  });
});

describe("withMarks", () => {
  it("stores the markers on the edit, which the edit document accepts", () => {
    const next = putMark([], mark({ id: "a" }), window);
    const edit = withMarks(null, next ?? []);
    expect(edit?.marks).toHaveLength(1);
    expect(parseClipEdit(edit).ok).toBe(true);
  });

  it("drops an edit that no longer changes anything", () => {
    expect(withMarks({ ...EMPTY_EDIT, marks: [mark()] }, [])).toBeNull();
  });
});
