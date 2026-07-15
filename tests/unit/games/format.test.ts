import { describe, expect, it } from "vitest";

import {
  formatDuration,
  formatPlayedOn,
  isUnnamedGame,
} from "@/features/games/format";

describe("formatDuration", () => {
  it("formats sub-hour lengths as MM:SS", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(599)).toBe("09:59");
  });

  it("formats hour-plus lengths as H:MM:SS", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("floors fractional seconds and clamps negatives", () => {
    expect(formatDuration(59.9)).toBe("00:59");
    expect(formatDuration(-5)).toBe("00:00");
  });
});

describe("formatPlayedOn", () => {
  it("reformats an ISO date as German DD.MM.YYYY", () => {
    expect(formatPlayedOn("2026-05-12")).toBe("12.05.2026");
  });

  it("returns null for a missing or malformed date", () => {
    expect(formatPlayedOn(null)).toBeNull();
    expect(formatPlayedOn("12.05.2026")).toBeNull();
  });
});

describe("isUnnamedGame", () => {
  it("treats an empty or whitespace-only title as needing a name", () => {
    expect(isUnnamedGame("")).toBe(true);
    expect(isUnnamedGame("   ")).toBe(true);
  });

  it("treats a real title as named", () => {
    expect(isUnnamedGame("Heim vs. Rot-Weiss")).toBe(false);
  });
});
