import { describe, expect, it } from "vitest";

import { teamSharePath, teamShareUrl } from "@/features/share/team";

const TOKEN = "s3cr3t-team-token-abcdef";

describe("teamSharePath", () => {
  it("appends the token to the team share route", () => {
    expect(teamSharePath(TOKEN)).toBe(`/share/team/${TOKEN}`);
  });
});

describe("teamShareUrl", () => {
  it("returns the app-relative path when no base URL is known", () => {
    expect(teamShareUrl(TOKEN)).toBe(`/share/team/${TOKEN}`);
    expect(teamShareUrl(TOKEN, undefined)).toBe(`/share/team/${TOKEN}`);
    expect(teamShareUrl(TOKEN, null)).toBe(`/share/team/${TOKEN}`);
  });

  it("joins an absolute base URL onto the path", () => {
    expect(teamShareUrl(TOKEN, "https://app.example.com")).toBe(
      `https://app.example.com/share/team/${TOKEN}`,
    );
  });

  it("trims a trailing slash on the base so the result never doubles up", () => {
    expect(teamShareUrl(TOKEN, "https://app.example.com/")).toBe(
      `https://app.example.com/share/team/${TOKEN}`,
    );
  });
});
