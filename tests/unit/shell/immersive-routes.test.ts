import { describe, expect, it } from "vitest";

import {
  hasOwnFooter,
  isImmersiveRoute,
} from "@/components/shell/immersive-routes";

describe("isImmersiveRoute", () => {
  it("matches the watch/tagging workspace", () => {
    expect(isImmersiveRoute("/games/abc123/watch")).toBe(true);
    expect(isImmersiveRoute("/games/42/watch/")).toBe(true);
  });

  it("matches the clip editor", () => {
    expect(isImmersiveRoute("/collections/abc123/editor")).toBe(true);
    expect(isImmersiveRoute("/collections/abc123/editor/")).toBe(true);
  });

  it("does not match other coach surfaces", () => {
    expect(isImmersiveRoute("/games")).toBe(false);
    expect(isImmersiveRoute("/games/42")).toBe(false);
    expect(isImmersiveRoute("/games/42/edit")).toBe(false);
    expect(isImmersiveRoute("/games/42/watch/extra")).toBe(false);
    expect(isImmersiveRoute("/players")).toBe(false);
    expect(isImmersiveRoute("/collections/42")).toBe(false);
    expect(isImmersiveRoute("/collections/42/editor/extra")).toBe(false);
    expect(isImmersiveRoute("/")).toBe(false);
  });
});

describe("hasOwnFooter", () => {
  it("matches the immersive HUD and the share links", () => {
    expect(hasOwnFooter("/games/42/watch")).toBe(true);
    expect(hasOwnFooter("/share/team/abc")).toBe(true);
    expect(hasOwnFooter("/share/player/abc")).toBe(true);
    expect(hasOwnFooter("/share/collection/abc")).toBe(true);
  });

  it("does not match pages that use the site footer", () => {
    expect(hasOwnFooter("/")).toBe(false);
    expect(hasOwnFooter("/login")).toBe(false);
    expect(hasOwnFooter("/games/42")).toBe(false);
    expect(hasOwnFooter("/datenschutz")).toBe(false);
    expect(hasOwnFooter("/shared")).toBe(false);
  });
});
