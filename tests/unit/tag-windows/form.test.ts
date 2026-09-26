import { describe, expect, it } from "vitest";

import {
  changedTagWindows,
  isDefaultTagWindows,
  parseTagWindowsInput,
  tagWindowField,
  tagWindowValues,
  type TagWindowField,
} from "@/features/tag-windows/form";
import { tagWindowsPayload } from "@/features/tag-windows/payload";
import {
  DEFAULT_TAG_WINDOWS,
  TAG_TYPES,
  resolveTagWindows,
} from "@/lib/tag-types";

/** A reader over the form values of `windows`, with `changes` on top. */
function reader(changes: Partial<Record<TagWindowField, string>> = {}) {
  const values: Partial<Record<TagWindowField, string>> = {
    ...tagWindowValues(DEFAULT_TAG_WINDOWS),
    ...changes,
  };
  return (field: TagWindowField) => values[field];
}

describe("tagWindowValues", () => {
  it("names one lead-in and one follow-through field per type", () => {
    const values = tagWindowValues(
      resolveTagWindows([{ type: "goal", preS: 15, postS: 5 }]),
    );
    expect(Object.keys(values)).toHaveLength(TAG_TYPES.length * 2);
    expect(values[tagWindowField("goal", "preS")]).toBe("15");
    expect(values[tagWindowField("goal", "postS")]).toBe("5");
    expect(values["corner_short.preS"]).toBe(
      String(DEFAULT_TAG_WINDOWS.corner_short.preS),
    );
  });
});

describe("parseTagWindowsInput", () => {
  it("reads whole seconds for every type", () => {
    const parsed = parseTagWindowsInput(
      reader({ "goal.preS": " 15 ", "goal.postS": "5" }),
    );
    expect(parsed).toEqual({
      ok: true,
      value: { ...DEFAULT_TAG_WINDOWS, goal: { preS: 15, postS: 5 } },
    });
  });

  it("accepts the bounds: no lead-in, a one-second follow-through, a minute", () => {
    const parsed = parseTagWindowsInput(
      reader({
        "goal.preS": "0",
        "goal.postS": "1",
        "corner_short.preS": "60",
      }),
    );
    expect(parsed.ok).toBe(true);
  });

  it("marks every field outside the bounds or not whole seconds", () => {
    const parsed = parseTagWindowsInput(
      reader({
        "goal.preS": "61",
        "goal.postS": "0",
        "corner_short.preS": "-1",
        "corner_short.postS": "4.5",
        "action_good.preS": "",
        "action_bad.postS": "abc",
      }),
    );
    expect(parsed).toEqual({
      ok: false,
      invalid: [
        "goal.preS",
        "goal.postS",
        "corner_short.preS",
        "corner_short.postS",
        "action_good.preS",
        "action_bad.postS",
      ],
    });
  });

  it("refuses a form that leaves a field out, so half a window never lands", () => {
    const parsed = parseTagWindowsInput((field) =>
      field === "goal.postS" ? undefined : reader()(field),
    );
    expect(parsed).toEqual({ ok: false, invalid: ["goal.postS"] });
  });
});

describe("changedTagWindows", () => {
  it("lists only the windows that differ from their default", () => {
    const windows = resolveTagWindows([
      { type: "goal", preS: 15, postS: 5 },
      { type: "corner_short", ...DEFAULT_TAG_WINDOWS.corner_short },
    ]);
    expect(changedTagWindows(windows)).toEqual([
      { type: "goal", window: { preS: 15, postS: 5 } },
    ]);
    expect(isDefaultTagWindows(windows)).toBe(false);
  });

  it("is empty for the defaults, which is what a reset stores", () => {
    expect(changedTagWindows(DEFAULT_TAG_WINDOWS)).toEqual([]);
    expect(isDefaultTagWindows(DEFAULT_TAG_WINDOWS)).toBe(true);
  });
});

describe("tagWindowsPayload", () => {
  it("lists every type in display order with its effective window", () => {
    const payload = tagWindowsPayload(
      resolveTagWindows([{ type: "goal", preS: 15, postS: 5 }]),
    );
    expect(payload.windows.map((window) => window.type)).toEqual(
      TAG_TYPES.map((type) => type.key),
    );
    expect(payload.windows[0]).toEqual({
      type: "goal",
      preS: 15,
      postS: 5,
      isDefault: false,
    });
    expect(payload.windows[1]).toEqual({
      type: "corner_short",
      ...DEFAULT_TAG_WINDOWS.corner_short,
      isDefault: true,
    });
  });
});
