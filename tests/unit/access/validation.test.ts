import { describe, expect, it } from "vitest";

import {
  normalizeEmail,
  sanitizeNext,
  validateEmail,
  validateName,
  validatePassword,
} from "@/features/access/validation";

describe("normalizeEmail", () => {
  it("trims and lowercases so case never splits an account", () => {
    expect(normalizeEmail("  Coach@Example.COM ")).toBe("coach@example.com");
  });
});

describe("validateEmail", () => {
  it("accepts a well-formed address", () => {
    expect(validateEmail("coach@club.de")).toBeNull();
  });

  it("rejects an empty or malformed address", () => {
    expect(validateEmail("")).not.toBeNull();
    expect(validateEmail("no-at-sign")).not.toBeNull();
    expect(validateEmail("a@b")).not.toBeNull();
    expect(validateEmail("a b@c.de")).not.toBeNull();
  });
});

describe("validatePassword", () => {
  it("accepts a password of at least 8 characters", () => {
    expect(validatePassword("12345678")).toBeNull();
  });

  it("rejects an empty or too-short password", () => {
    expect(validatePassword("")).not.toBeNull();
    expect(validatePassword("short")).not.toBeNull();
  });
});

describe("validateName", () => {
  it("accepts a non-empty name and rejects a blank one", () => {
    expect(validateName("Coach K")).toBeNull();
    expect(validateName("   ")).not.toBeNull();
  });
});

describe("sanitizeNext", () => {
  it("keeps a same-origin path", () => {
    expect(sanitizeNext("/games/42", "/")).toBe("/games/42");
  });

  it("falls back for absent, absolute, or protocol-relative targets", () => {
    expect(sanitizeNext(null, "/home")).toBe("/home");
    expect(sanitizeNext("", "/home")).toBe("/home");
    expect(sanitizeNext("https://evil.example/phish", "/home")).toBe("/home");
    expect(sanitizeNext("//evil.example", "/home")).toBe("/home");
    expect(sanitizeNext("/\\evil.example", "/home")).toBe("/home");
  });
});
