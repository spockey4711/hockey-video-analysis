import { describe, expect, it } from "vitest";

import {
  MAX_NAME_LENGTH,
  isValidId,
  normalizeClipIds,
  normalizeName,
} from "@/features/share/collections/validation";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("isValidId", () => {
  it("accepts a well-formed UUID", () => {
    expect(isValidId(UUID_A)).toBe(true);
  });

  it("rejects a non-string or a malformed id", () => {
    expect(isValidId(undefined)).toBe(false);
    expect(isValidId(123)).toBe(false);
    expect(isValidId("not-a-uuid")).toBe(false);
    expect(isValidId("")).toBe(false);
  });
});

describe("normalizeName", () => {
  it("trims surrounding whitespace and returns the stored value", () => {
    expect(normalizeName("  Standards Woche 3 ")).toBe("Standards Woche 3");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(normalizeName("")).toBeNull();
    expect(normalizeName("   ")).toBeNull();
  });

  it("rejects a name over the max length", () => {
    expect(normalizeName("a".repeat(MAX_NAME_LENGTH))).not.toBeNull();
    expect(normalizeName("a".repeat(MAX_NAME_LENGTH + 1))).toBeNull();
  });

  it("rejects a non-string", () => {
    expect(normalizeName(undefined)).toBeNull();
    expect(normalizeName(42)).toBeNull();
  });
});

describe("normalizeClipIds", () => {
  it("keeps only well-formed, unique ids", () => {
    expect(normalizeClipIds([UUID_A, UUID_B, UUID_A])).toEqual([
      UUID_A,
      UUID_B,
    ]);
  });

  it("drops malformed or non-string entries rather than failing", () => {
    expect(normalizeClipIds([UUID_A, "bad", 7, null])).toEqual([UUID_A]);
  });

  it("returns an empty list when nothing is valid", () => {
    expect(normalizeClipIds([])).toEqual([]);
    expect(normalizeClipIds(["", "nope"])).toEqual([]);
  });
});
