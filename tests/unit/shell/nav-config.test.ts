import { describe, expect, it } from "vitest";

import { isNavItemActive, PRIMARY_NAV } from "@/components/shell/nav-config";

describe("isNavItemActive", () => {
  it("matches the exact section route", () => {
    expect(isNavItemActive("/games", "/games")).toBe(true);
  });

  it("matches a descendant route", () => {
    expect(isNavItemActive("/games", "/games/42/watch")).toBe(true);
  });

  it("does not match a sibling that only shares the prefix", () => {
    expect(isNavItemActive("/games", "/games-archive")).toBe(false);
  });

  it("does not match an unrelated route", () => {
    expect(isNavItemActive("/games", "/")).toBe(false);
  });
});

describe("PRIMARY_NAV", () => {
  it("links the games section to the games list", () => {
    expect(PRIMARY_NAV.some((item) => item.href === "/games")).toBe(true);
  });

  it("links the roster section to the players list", () => {
    expect(PRIMARY_NAV.some((item) => item.href === "/players")).toBe(true);
  });

  it("links the settings section to the settings page", () => {
    expect(PRIMARY_NAV.some((item) => item.href === "/settings")).toBe(true);
  });
});
