import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  isTheme,
  isThemePreference,
  nextTheme,
  preferenceFromStorage,
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

describe("isThemePreference", () => {
  it("accepts system and the two themes", () => {
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isThemePreference("auto")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});

describe("preferenceFromStorage", () => {
  it("reads a stored theme as a fixed choice", () => {
    expect(preferenceFromStorage("light")).toBe("light");
    expect(preferenceFromStorage("dark")).toBe("dark");
  });

  it("reads nothing stored, or an unknown value, as system", () => {
    expect(preferenceFromStorage(null)).toBe("system");
    expect(preferenceFromStorage("system")).toBe("system");
    expect(preferenceFromStorage("neon")).toBe("system");
  });
});

describe("resolveTheme for each preference", () => {
  it("follows the OS for system", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
  });

  it("keeps light whatever the OS asks for", () => {
    expect(resolveTheme("light", false)).toBe("light");
  });

  it("keeps dark whatever the OS asks for", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
  });
});
