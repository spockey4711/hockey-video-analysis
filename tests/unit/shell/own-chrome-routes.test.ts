import { describe, expect, it } from "vitest";

import { hasOwnChrome } from "@/components/shell/own-chrome-routes";

describe("hasOwnChrome", () => {
  it("matches the watch/tagging workspace", () => {
    expect(hasOwnChrome("/games/abc123/watch")).toBe(true);
    expect(hasOwnChrome("/games/42/watch/")).toBe(true);
  });

  it("matches the clip editor", () => {
    expect(hasOwnChrome("/collections/abc123/editor")).toBe(true);
    expect(hasOwnChrome("/collections/abc123/editor/")).toBe(true);
  });

  it("matches every share link family", () => {
    expect(hasOwnChrome("/share/team/abc")).toBe(true);
    expect(hasOwnChrome("/share/player/abc")).toBe(true);
    expect(hasOwnChrome("/share/player/abc/")).toBe(true);
    expect(hasOwnChrome("/share/collection/abc")).toBe(true);
    expect(hasOwnChrome("/share")).toBe(true);
  });

  it("does not match pages that use the coach shell", () => {
    expect(hasOwnChrome("/")).toBe(false);
    expect(hasOwnChrome("/login")).toBe(false);
    expect(hasOwnChrome("/games")).toBe(false);
    expect(hasOwnChrome("/games/42")).toBe(false);
    expect(hasOwnChrome("/games/42/edit")).toBe(false);
    expect(hasOwnChrome("/games/42/watch/extra")).toBe(false);
    expect(hasOwnChrome("/players")).toBe(false);
    expect(hasOwnChrome("/collections/42")).toBe(false);
    expect(hasOwnChrome("/collections/42/editor/extra")).toBe(false);
    expect(hasOwnChrome("/tactics/42")).toBe(false);
    expect(hasOwnChrome("/datenschutz")).toBe(false);
    expect(hasOwnChrome("/shared")).toBe(false);
    expect(hasOwnChrome("/players/share/abc")).toBe(false);
  });
});
