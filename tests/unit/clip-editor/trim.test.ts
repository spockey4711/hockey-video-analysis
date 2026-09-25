import { describe, expect, it } from "vitest";

import {
  editAfterLengthening,
  LENGTHEN_STEP_S,
  lengthenWindow,
  moveEdge,
  trimOf,
  withTrim,
} from "@/features/clip-editor/trim";
import { type ClipEdit, EMPTY_EDIT, MIN_TRIM_S } from "@/features/clip-edits";

const window = { startS: 100, endS: 112 };

function edited(trim: ClipEdit["trim"]): ClipEdit {
  return { ...EMPTY_EDIT, trim };
}

describe("trimOf", () => {
  it("is the stored trim, or the whole window without one", () => {
    expect(trimOf(null, window)).toEqual(window);
    expect(trimOf(edited({ startS: 102, endS: 110 }), window)).toEqual({
      startS: 102,
      endS: 110,
    });
  });
});

describe("moveEdge", () => {
  const trim = { startS: 102, endS: 110 };

  it("moves the in or the out point to a moment", () => {
    expect(moveEdge(trim, window, "in", 104.25)).toEqual({
      startS: 104.25,
      endS: 110,
    });
    expect(moveEdge(trim, window, "out", 108)).toEqual({
      startS: 102,
      endS: 108,
    });
  });

  it("keeps both points inside the window", () => {
    expect(moveEdge(trim, window, "in", 90).startS).toBe(100);
    expect(moveEdge(trim, window, "out", 130).endS).toBe(112);
  });

  it("stops a point short of the other one", () => {
    expect(moveEdge(trim, window, "in", 111).startS).toBe(110 - MIN_TRIM_S);
    expect(moveEdge(trim, window, "out", 90).endS).toBe(102 + MIN_TRIM_S);
  });

  it("keeps times to the millisecond", () => {
    expect(moveEdge(trim, window, "in", 103.12345).startS).toBe(103.123);
  });
});

describe("withTrim", () => {
  it("sets the trim on an edit, starting from none", () => {
    expect(withTrim(null, { startS: 102, endS: 110 }, window)).toEqual(
      edited({ startS: 102, endS: 110 }),
    );
  });

  it("stores a trim over the whole window as no edit at all", () => {
    expect(withTrim(edited({ startS: 102, endS: 110 }), window, window)).toBe(
      null,
    );
    expect(withTrim(edited({ startS: 102, endS: 110 }), null, window)).toBe(
      null,
    );
  });

  it("keeps the rest of the edit when the trim goes", () => {
    const slow: ClipEdit = {
      ...edited({ startS: 102, endS: 110 }),
      slow: [{ startS: 104, endS: 106, rate: 0.5 }],
    };
    expect(withTrim(slow, null, window)).toEqual({ ...slow, trim: null });
  });
});

describe("lengthenWindow", () => {
  it("adds footage before or after the clip", () => {
    expect(lengthenWindow(window, "before", 3600)).toEqual({
      startS: 100 - LENGTHEN_STEP_S,
      endS: 112,
    });
    expect(lengthenWindow(window, "after", 3600)).toEqual({
      startS: 100,
      endS: 112 + LENGTHEN_STEP_S,
    });
  });

  it("stops at the start and the end of the game", () => {
    expect(lengthenWindow({ startS: 1, endS: 12 }, "before", 3600)).toEqual({
      startS: 0,
      endS: 12,
    });
    expect(lengthenWindow({ startS: 0, endS: 12 }, "before", 3600)).toBeNull();
    expect(lengthenWindow({ startS: 3590, endS: 3600 }, "after", 3600)).toBe(
      null,
    );
  });

  it("has no end for a game of unknown length", () => {
    expect(lengthenWindow(window, "after", 0)?.endS).toBe(114);
  });
});

describe("editAfterLengthening", () => {
  const grown = { startS: 98, endS: 112 };

  it("moves the trim's edge on the grown side out to the new window", () => {
    expect(
      editAfterLengthening(edited({ startS: 102, endS: 110 }), grown, "before"),
    ).toEqual(edited({ startS: 98, endS: 110 }));
  });

  it("drops a trim that then covers the whole window", () => {
    expect(
      editAfterLengthening(edited({ startS: 102, endS: 112 }), grown, "before"),
    ).toBeNull();
  });

  it("leaves an edit without a trim as it is", () => {
    expect(editAfterLengthening(null, grown, "after")).toBeNull();
  });
});
