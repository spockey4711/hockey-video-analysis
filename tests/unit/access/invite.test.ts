import { afterEach, describe, expect, it, vi } from "vitest";

import { isSignupEnabled, verifyInviteCode } from "@/features/access/invite";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("invite gating", () => {
  it("disables signup when no invite code is configured", () => {
    vi.stubEnv("AUTH_INVITE_CODE", "");
    expect(isSignupEnabled()).toBe(false);
    expect(verifyInviteCode("anything")).toBe(false);
  });

  it("enables signup and accepts the exact code when configured", () => {
    vi.stubEnv("AUTH_INVITE_CODE", "team-secret");
    expect(isSignupEnabled()).toBe(true);
    expect(verifyInviteCode("team-secret")).toBe(true);
  });

  it("rejects a wrong code, including a length mismatch", () => {
    vi.stubEnv("AUTH_INVITE_CODE", "team-secret");
    expect(verifyInviteCode("wrong")).toBe(false);
    expect(verifyInviteCode("team-secret-extra")).toBe(false);
    expect(verifyInviteCode("")).toBe(false);
  });
});
