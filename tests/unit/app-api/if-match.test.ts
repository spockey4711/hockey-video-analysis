import { describe, expect, it } from "vitest";

import { entityTag, parseIfMatch } from "@/features/app-api/if-match";

describe("parseIfMatch", () => {
  it("writes without the check when there is no header", () => {
    expect(parseIfMatch(null)).toEqual({ ok: true, version: null });
  });

  it("reads the version from a strong entity tag", () => {
    expect(parseIfMatch('"7"')).toEqual({ ok: true, version: 7 });
    expect(parseIfMatch(' "12" ')).toEqual({ ok: true, version: 12 });
  });

  it("accepts the bare version too", () => {
    expect(parseIfMatch("3")).toEqual({ ok: true, version: 3 });
  });

  it.each([
    "",
    "*",
    'W/"3"',
    '"3", "4"',
    '"3',
    '3"',
    '"0"',
    '"03"',
    '"-1"',
    '"1.5"',
    '"abc"',
    '"2147483648"',
    '"99999999999"',
  ])("refuses %j, which names no single version", (raw) => {
    expect(parseIfMatch(raw).ok).toBe(false);
  });

  it("accepts the largest version a column holds", () => {
    expect(parseIfMatch('"2147483647"')).toEqual({
      ok: true,
      version: 2147483647,
    });
  });
});

describe("entityTag", () => {
  it("quotes the version as a strong entity tag", () => {
    expect(entityTag(4)).toBe('"4"');
    expect(parseIfMatch(entityTag(4))).toEqual({ ok: true, version: 4 });
  });
});
