import { describe, expect, it } from "vitest";

import { markerColorVar } from "@/features/player/jump-markers/marker-colors";

describe("markerColorVar", () => {
  it("maps each configured tag type to its design token", () => {
    expect(markerColorVar("goal")).toBe("--tag-tor");
    expect(markerColorVar("corner_short")).toBe("--tag-ecke");
    expect(markerColorVar("action_good")).toBe("--tag-gut");
    expect(markerColorVar("action_bad")).toBe("--tag-schlecht");
  });

  it("falls back to a neutral token for an unknown type", () => {
    expect(markerColorVar("mystery")).toBe("--text-secondary");
  });
});
