import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  isTheme,
  nextTheme,
  resolveTheme,
} from "@/components/shell/theme";

describe("isTheme", () => {
  it("accepts the known themes", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("light")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isTheme("system")).toBe(false);
    expect(isTheme("")).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme(1)).toBe(false);
  });
});

describe("nextTheme", () => {
  it("flips between the two themes", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
  });
});

describe("resolveTheme", () => {
  it("prefers an explicit stored choice over the OS preference", () => {
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
  });

  it("falls back to the OS preference when nothing is stored", () => {
    expect(resolveTheme(null, true)).toBe("light");
    expect(resolveTheme(null, false)).toBe(DEFAULT_THEME);
  });

  it("ignores a corrupt stored value", () => {
    expect(resolveTheme("neon", true)).toBe("light");
    expect(resolveTheme("neon", false)).toBe(DEFAULT_THEME);
  });
});
