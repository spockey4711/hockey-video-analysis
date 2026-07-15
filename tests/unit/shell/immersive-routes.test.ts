import { describe, expect, it } from "vitest";

import { isImmersiveRoute } from "@/components/shell/immersive-routes";

describe("isImmersiveRoute", () => {
  it("matches the watch/tagging workspace", () => {
    expect(isImmersiveRoute("/games/abc123/watch")).toBe(true);
    expect(isImmersiveRoute("/games/42/watch/")).toBe(true);
  });

  it("does not match other coach surfaces", () => {
    expect(isImmersiveRoute("/games")).toBe(false);
    expect(isImmersiveRoute("/games/42")).toBe(false);
    expect(isImmersiveRoute("/games/42/edit")).toBe(false);
    expect(isImmersiveRoute("/games/42/watch/extra")).toBe(false);
    expect(isImmersiveRoute("/players")).toBe(false);
    expect(isImmersiveRoute("/")).toBe(false);
  });
});
