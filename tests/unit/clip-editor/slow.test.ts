import { describe, expect, it } from "vitest";

import {
  addSlowRange,
  DEFAULT_SLOW_RATE,
  MIN_SLOW_S,
  moveSlowEdge,
  removeSlowRange,
  setSlowRate,
  slowRangeAt,
  withSlow,
} from "@/features/clip-editor/slow";
import {
  EMPTY_EDIT,
  MAX_SLOW_RANGES,
  parseClipEdit,
  type SlowRange,
} from "@/features/clip-edits";

const window = { startS: 100, endS: 112 };
const slow: SlowRange[] = [
  { startS: 102, endS: 104, rate: 0.5 },
  { startS: 108, endS: 109, rate: 0.25 },
];

describe("addSlowRange", () => {
  it("adds a range dragged either way round at half speed, in play order", () => {
    expect(addSlowRange(slow, 106.5, 105, window)).toEqual({
      slow: [
        slow[0],
        { startS: 105, endS: 106.5, rate: DEFAULT_SLOW_RATE },
        slow[1],
      ],
      index: 1,
    });
  });

  it("stops a range short of its neighbours and the window", () => {
    expect(addSlowRange(slow, 105, 110, window)?.slow[1]).toMatchObject({
      startS: 105,
      endS: 108,
    });
    expect(addSlowRange([], 99, 101, window)?.slow[0]).toMatchObject({
      startS: 100,
      endS: 101,
    });
    expect(addSlowRange(slow, 110, 120, window)?.slow[2]).toMatchObject({
      startS: 110,
      endS: 112,
    });
  });

  it("grows a very short drag to the shortest range", () => {
    const added = addSlowRange([], 105, 105.05, window);
    expect(added?.slow[0]).toMatchObject({
      startS: 105,
      endS: 105 + MIN_SLOW_S,
    });
    // At the end of the window it grows backwards.
    expect(addSlowRange([], 112, 112, window)?.slow[0]).toMatchObject({
      startS: 111.8,
      endS: 112,
    });
  });

  it("refuses a range inside another, in a gap too small, or past the cap", () => {
    expect(addSlowRange(slow, 103, 106, window)).toBeNull();
    const tight: SlowRange[] = [
      { startS: 102, endS: 104, rate: 0.5 },
      { startS: 104.1, endS: 106, rate: 0.5 },
    ];
    expect(addSlowRange(tight, 104.05, 104.06, window)).toBeNull();
    const full = Array.from({ length: MAX_SLOW_RANGES }, (_, index) => ({
      startS: 100 + index,
      endS: 100.5 + index,
      rate: 0.5 as const,
    }));
    expect(addSlowRange(full, 110.6, 111.5, window)).toBeNull();
  });

  it("keeps times to the millisecond and makes a valid edit", () => {
    const added = addSlowRange([], 101.23456, 103.98765, window);
    expect(added?.slow[0]).toMatchObject({ startS: 101.235, endS: 103.988 });
    const edit = withSlow(null, added?.slow ?? []);
    expect(parseClipEdit(edit).ok).toBe(true);
  });
});

describe("moveSlowEdge", () => {
  it("moves a start or an end, stopping at neighbours and the window", () => {
    expect(moveSlowEdge(slow, 0, "start", 101, window)[0].startS).toBe(101);
    expect(moveSlowEdge(slow, 0, "start", 90, window)[0].startS).toBe(100);
    expect(moveSlowEdge(slow, 0, "end", 110, window)[0].endS).toBe(108);
    expect(moveSlowEdge(slow, 1, "start", 103, window)[1].startS).toBe(104);
    expect(moveSlowEdge(slow, 1, "end", 120, window)[1].endS).toBe(112);
  });

  it("keeps a range at least the shortest length", () => {
    expect(moveSlowEdge(slow, 0, "start", 105, window)[0].startS).toBe(
      104 - MIN_SLOW_S,
    );
    expect(moveSlowEdge(slow, 0, "end", 101, window)[0].endS).toBe(
      102 + MIN_SLOW_S,
    );
  });
});

describe("range changes", () => {
  it("sets a range's speed, removes one, and finds the one at a moment", () => {
    expect(setSlowRate(slow, 0, 0.25)[0].rate).toBe(0.25);
    expect(removeSlowRange(slow, 0)).toEqual([slow[1]]);
    expect(slowRangeAt(slow, 108.5)).toBe(1);
    expect(slowRangeAt(slow, 104)).toBe(-1);
  });

  it("stores no edit once the last range is gone and nothing else is set", () => {
    expect(withSlow({ ...EMPTY_EDIT, slow }, [])).toBeNull();
    const trimmed = { ...EMPTY_EDIT, trim: { startS: 101, endS: 110 } };
    expect(withSlow(trimmed, [])).toEqual(trimmed);
  });
});
