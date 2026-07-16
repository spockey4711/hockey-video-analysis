import { describe, expect, it } from "vitest";

import { isValidPlayerId } from "@/features/players/gdpr";

describe("isValidPlayerId (gdpr)", () => {
  it("accepts a well-formed UUID in either case", () => {
    expect(isValidPlayerId("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
    expect(isValidPlayerId("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true);
  });

  it("rejects strings that are not a UUID", () => {
    expect(isValidPlayerId("")).toBe(false);
    expect(isValidPlayerId("not-a-uuid")).toBe(false);
    expect(isValidPlayerId("3f2504e0-4f89-41d3-9a0c-0305e82c330")).toBe(false);
  });

  it("rejects non-string input a client might smuggle in", () => {
    expect(isValidPlayerId(undefined)).toBe(false);
    expect(isValidPlayerId(null)).toBe(false);
    expect(isValidPlayerId(42)).toBe(false);
  });
});
