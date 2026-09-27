import { describe, expect, it } from "vitest";

import {
  hasTagType,
  normalizeExtraTypes,
  parseExtraTypes,
  tagTypeKeys,
  tagTypesFromSelection,
  tagTypesLabel,
} from "@/lib/tag-types";

// A short corner that ended in a goal: one tag, one clip, two types (ADR 0016).
const cornerGoal = { type: "corner_short", extraTypes: ["goal"] };

describe("a tag's types", () => {
  it("lists the main type first, then the further types", () => {
    expect(tagTypeKeys(cornerGoal)).toEqual(["corner_short", "goal"]);
    expect(tagTypeKeys({ type: "goal", extraTypes: [] })).toEqual(["goal"]);
  });

  it("counts a tag as each of its types", () => {
    expect(hasTagType(cornerGoal, "corner_short")).toBe(true);
    expect(hasTagType(cornerGoal, "goal")).toBe(true);
    expect(hasTagType(cornerGoal, "action_good")).toBe(false);
  });

  it("titles a tag by all its types, keeping an unknown key as stored", () => {
    expect(tagTypesLabel(cornerGoal)).toBe("Ecke kurz + Tor");
    expect(tagTypesLabel({ type: "goal", extraTypes: [] })).toBe("Tor");
    expect(tagTypesLabel({ type: "retired", extraTypes: ["goal"] })).toBe(
      "retired + Tor",
    );
  });
});

describe("normalizeExtraTypes", () => {
  it("drops the main type and repeats and keeps the config's order", () => {
    expect(
      normalizeExtraTypes("goal", [
        "action_bad",
        "goal",
        "corner_short",
        "action_bad",
      ]),
    ).toEqual(["corner_short", "action_bad"]);
  });
});

describe("parseExtraTypes", () => {
  it("accepts a list of configured keys, normalized", () => {
    expect(parseExtraTypes([], "goal")).toEqual([]);
    expect(parseExtraTypes(["goal", "corner_short"], "goal")).toEqual([
      "corner_short",
    ]);
  });

  it("refuses anything else, so an unknown key is never stored", () => {
    for (const raw of [
      undefined,
      null,
      "goal",
      { 0: "goal" },
      ["penalty"],
      [3],
    ]) {
      expect(parseExtraTypes(raw, "goal")).toBeNull();
    }
  });
});

describe("tagTypesFromSelection", () => {
  it("keeps the main type while it is on", () => {
    expect(
      tagTypesFromSelection(["goal", "corner_short"], "corner_short"),
    ).toEqual(cornerGoal);
  });

  it("makes the first type that is on the main type once it is off", () => {
    expect(
      tagTypesFromSelection(["action_bad", "goal"], "corner_short"),
    ).toEqual({ type: "goal", extraTypes: ["action_bad"] });
  });

  it("has no types when none is on", () => {
    expect(tagTypesFromSelection([], "goal")).toBeNull();
  });
});
