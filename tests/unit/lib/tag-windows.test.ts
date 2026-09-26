import { describe, expect, it } from "vitest";

import {
  DEFAULT_TAG_WINDOWS,
  MAX_POST_S,
  MAX_PRE_S,
  MIN_POST_S,
  MIN_PRE_S,
  TAG_TYPES,
  getTagType,
  isTagWindow,
  resolveTagWindows,
  sameTagWindow,
  withTagWindow,
} from "@/lib/tag-types";

describe("DEFAULT_TAG_WINDOWS", () => {
  it("holds every configured type's default window", () => {
    expect(Object.keys(DEFAULT_TAG_WINDOWS)).toEqual(
      TAG_TYPES.map((type) => type.key),
    );
    for (const type of TAG_TYPES) {
      expect(DEFAULT_TAG_WINDOWS[type.key]).toEqual(type.window);
    }
  });

  it("keeps every default inside the team bounds", () => {
    for (const window of Object.values(DEFAULT_TAG_WINDOWS)) {
      expect(isTagWindow(window)).toBe(true);
    }
  });
});

describe("isTagWindow", () => {
  it("accepts whole seconds at both bounds", () => {
    expect(isTagWindow({ preS: MIN_PRE_S, postS: MIN_POST_S })).toBe(true);
    expect(isTagWindow({ preS: MAX_PRE_S, postS: MAX_POST_S })).toBe(true);
    expect(isTagWindow({ preS: 15, postS: 5 })).toBe(true);
  });

  it.each([
    ["a negative lead-in", { preS: -1, postS: 5 }],
    ["a lead-in past the bound", { preS: MAX_PRE_S + 1, postS: 5 }],
    ["an empty follow-through", { preS: 10, postS: 0 }],
    ["a follow-through past the bound", { preS: 10, postS: MAX_POST_S + 1 }],
    ["a fractional second", { preS: 10.5, postS: 5 }],
    ["a missing value", { preS: 10, postS: undefined }],
    ["a string", { preS: "10", postS: 5 }],
    ["not a number", { preS: Number.NaN, postS: 5 }],
  ])("rejects %s", (_name, window) => {
    expect(isTagWindow(window)).toBe(false);
  });
});

describe("sameTagWindow", () => {
  it("compares both edges", () => {
    expect(sameTagWindow({ preS: 10, postS: 5 }, { preS: 10, postS: 5 })).toBe(
      true,
    );
    expect(sameTagWindow({ preS: 10, postS: 5 }, { preS: 15, postS: 5 })).toBe(
      false,
    );
    expect(sameTagWindow({ preS: 10, postS: 5 }, { preS: 10, postS: 6 })).toBe(
      false,
    );
  });
});

describe("resolveTagWindows", () => {
  it("is the defaults when the team set nothing", () => {
    expect(resolveTagWindows([])).toEqual(DEFAULT_TAG_WINDOWS);
  });

  it("replaces only the types the team set", () => {
    const windows = resolveTagWindows([{ type: "goal", preS: 15, postS: 5 }]);
    expect(windows.goal).toEqual({ preS: 15, postS: 5 });
    expect(windows.corner_short).toEqual(DEFAULT_TAG_WINDOWS.corner_short);
    expect(windows.action_good).toEqual(DEFAULT_TAG_WINDOWS.action_good);
  });

  it("ignores a retired type and a window outside the bounds", () => {
    const windows = resolveTagWindows([
      { type: "retired_type", preS: 5, postS: 5 },
      { type: "toString", preS: 5, postS: 5 },
      { type: "goal", preS: 90, postS: 5 },
      { type: "corner_short", preS: 8, postS: 0 },
    ]);
    expect(windows).toEqual(DEFAULT_TAG_WINDOWS);
  });

  it("never changes the defaults it starts from", () => {
    resolveTagWindows([{ type: "goal", preS: 30, postS: 30 }]);
    expect(DEFAULT_TAG_WINDOWS.goal).toEqual(getTagType("goal")?.window);
  });
});

describe("withTagWindow", () => {
  it("gives a type its effective window and keeps the rest of it", () => {
    const goal = getTagType("goal");
    if (!goal) throw new Error("the goal type is configured");
    const windows = resolveTagWindows([{ type: "goal", preS: 15, postS: 5 }]);
    expect(withTagWindow(goal, windows)).toEqual({
      ...goal,
      window: { preS: 15, postS: 5 },
    });
  });

  it("keeps a type's own window when the windows do not list it", () => {
    const type = { key: "toString", window: { preS: 3, postS: 4 } };
    expect(withTagWindow(type, DEFAULT_TAG_WINDOWS)).toBe(type);
  });
});
