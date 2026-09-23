import { describe, expect, it } from "vitest";

import { clipWindowChanged } from "@/features/tagging/edit/recut";

const before = { type: "goal", startS: 100, endS: 115 };

describe("clipWindowChanged", () => {
  it("is false for an unchanged window", () => {
    expect(clipWindowChanged(before, { ...before })).toBe(false);
  });

  it("is true when the start moves", () => {
    expect(clipWindowChanged(before, { ...before, startS: 98 })).toBe(true);
  });

  it("is true when the end moves", () => {
    expect(clipWindowChanged(before, { ...before, endS: 120 })).toBe(true);
  });

  it("is true when an explicit end is cleared back to the default", () => {
    expect(clipWindowChanged(before, { ...before, endS: null })).toBe(true);
  });

  it("ignores a relabel when the tag has an explicit end", () => {
    expect(clipWindowChanged(before, { ...before, type: "corner_short" })).toBe(
      false,
    );
  });

  it("counts a relabel when the end comes from the type's default window", () => {
    const open = { ...before, endS: null };
    expect(clipWindowChanged(open, { ...open, type: "corner_short" })).toBe(
      true,
    );
  });
});
