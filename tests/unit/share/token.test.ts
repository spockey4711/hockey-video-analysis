import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getTeamShareToken,
  verifyTeamShareToken,
} from "@/features/share/team/token";

const SECRET = "s3cr3t-team-token-abcdef";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getTeamShareToken", () => {
  it("returns the configured token", () => {
    vi.stubEnv("TEAM_SHARE_TOKEN", SECRET);
    expect(getTeamShareToken()).toBe(SECRET);
  });

  it("treats unset or whitespace-only as disabled", () => {
    vi.stubEnv("TEAM_SHARE_TOKEN", "");
    expect(getTeamShareToken()).toBeUndefined();
    vi.stubEnv("TEAM_SHARE_TOKEN", "   ");
    expect(getTeamShareToken()).toBeUndefined();
  });

  it("trims surrounding whitespace", () => {
    vi.stubEnv("TEAM_SHARE_TOKEN", `  ${SECRET}  `);
    expect(getTeamShareToken()).toBe(SECRET);
  });
});

describe("verifyTeamShareToken", () => {
  it("accepts the exact token", () => {
    vi.stubEnv("TEAM_SHARE_TOKEN", SECRET);
    expect(verifyTeamShareToken(SECRET)).toBe(true);
  });

  it("rejects a wrong token", () => {
    vi.stubEnv("TEAM_SHARE_TOKEN", SECRET);
    expect(verifyTeamShareToken("wrong")).toBe(false);
    expect(verifyTeamShareToken(`${SECRET}x`)).toBe(false);
  });

  it("rejects every candidate when the view is disabled", () => {
    vi.stubEnv("TEAM_SHARE_TOKEN", "");
    expect(verifyTeamShareToken(SECRET)).toBe(false);
    expect(verifyTeamShareToken("")).toBe(false);
  });

  it("rejects non-string and empty candidates", () => {
    vi.stubEnv("TEAM_SHARE_TOKEN", SECRET);
    expect(verifyTeamShareToken("")).toBe(false);
    expect(verifyTeamShareToken(undefined)).toBe(false);
    expect(verifyTeamShareToken(null)).toBe(false);
    expect(verifyTeamShareToken(123)).toBe(false);
  });
});
