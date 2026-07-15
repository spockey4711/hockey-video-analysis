import { describe, expect, it } from "vitest";

import { generateShareToken } from "@/features/access/rotation";

describe("generateShareToken", () => {
  it("returns 64 lowercase hex characters (256 bits of entropy)", () => {
    expect(generateShareToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a distinct value on each call", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generateShareToken()),
    );
    expect(tokens.size).toBe(100);
  });
});
