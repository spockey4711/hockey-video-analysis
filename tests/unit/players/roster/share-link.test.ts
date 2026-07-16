import { describe, expect, it } from "vitest";

import { playerSharePath, playerShareUrl } from "@/features/players/roster";

const TOKEN = "a".repeat(64);

describe("playerSharePath", () => {
  it("appends the token to the per-player share route", () => {
    expect(playerSharePath(TOKEN)).toBe(`/share/player/${TOKEN}`);
  });
});

describe("playerShareUrl", () => {
  it("returns the app-relative path when no base URL is known", () => {
    expect(playerShareUrl(TOKEN)).toBe(`/share/player/${TOKEN}`);
    expect(playerShareUrl(TOKEN, undefined)).toBe(`/share/player/${TOKEN}`);
    expect(playerShareUrl(TOKEN, null)).toBe(`/share/player/${TOKEN}`);
  });

  it("joins an absolute base URL onto the path", () => {
    expect(playerShareUrl(TOKEN, "https://app.example.com")).toBe(
      `https://app.example.com/share/player/${TOKEN}`,
    );
  });

  it("trims a trailing slash on the base so the result never doubles up", () => {
    expect(playerShareUrl(TOKEN, "https://app.example.com/")).toBe(
      `https://app.example.com/share/player/${TOKEN}`,
    );
  });
});
