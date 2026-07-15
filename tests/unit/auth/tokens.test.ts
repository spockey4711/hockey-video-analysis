import { describe, expect, it } from "vitest";

import { generateSessionToken, hashSessionToken } from "@/lib/auth/tokens";

describe("session tokens", () => {
  it("generates a 256-bit hex token", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a fresh token each call", () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });

  it("hashes a token deterministically to a sha-256 hex digest", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("maps distinct tokens to distinct hashes and hides the raw token", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(hashSessionToken(a)).not.toBe(hashSessionToken(b));
    expect(hashSessionToken(a)).not.toBe(a);
  });
});
