import { describe, expect, it } from "vitest";

import {
  TAG_TYPES,
  getTagType,
  isTagTypeKey,
  tagTypeForHotkey,
} from "@/lib/tag-types";

/**
 * The tag-type config is the contract P0-6 (tagging) consumes, so these tests
 * pin the lookups and the config's internal consistency (unique keys/hotkeys,
 * positive windows) that `index.ts` asserts at load.
 */
describe("tag-types config", () => {
  it("defines a non-empty set with unique keys and hotkeys", () => {
    expect(TAG_TYPES.length).toBeGreaterThan(0);
    const keys = new Set(TAG_TYPES.map((t) => t.key));
    const hotkeys = new Set(TAG_TYPES.map((t) => t.hotkey.toLowerCase()));
    expect(keys.size).toBe(TAG_TYPES.length);
    expect(hotkeys.size).toBe(TAG_TYPES.length);
  });

  it("gives every type a strictly-positive follow-through window", () => {
    for (const type of TAG_TYPES) {
      expect(type.window.preS).toBeGreaterThanOrEqual(0);
      expect(type.window.postS).toBeGreaterThan(0);
    }
  });

  describe("getTagType", () => {
    it("resolves a known key and rejects an unknown one", () => {
      expect(getTagType("goal")?.label).toBe("Tor");
      expect(getTagType("nope")).toBeUndefined();
    });
  });

  describe("isTagTypeKey", () => {
    it("accepts configured keys only", () => {
      expect(isTagTypeKey("goal")).toBe(true);
      expect(isTagTypeKey("corner_short")).toBe(true);
      expect(isTagTypeKey("")).toBe(false);
      expect(isTagTypeKey("Goal")).toBe(false);
    });
  });

  describe("tagTypeForHotkey", () => {
    it("maps a bound key to its type, case-insensitively", () => {
      expect(tagTypeForHotkey("t")?.key).toBe("goal");
      expect(tagTypeForHotkey("T")?.key).toBe("goal");
    });

    it("returns undefined for an unbound key", () => {
      expect(tagTypeForHotkey("z")).toBeUndefined();
    });
  });
});
