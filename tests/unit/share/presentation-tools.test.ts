import { describe, expect, it } from "vitest";

import {
  isPointerShortcut,
  toggleTool,
} from "@/features/share/presentation/presentation-tools";

describe("toggleTool", () => {
  it("switches a tool on when none is on", () => {
    expect(toggleTool(null, "pointer")).toBe("pointer");
    expect(toggleTool(null, "draw")).toBe("draw");
  });

  it("switches the tool that is on off", () => {
    expect(toggleTool("pointer", "pointer")).toBeNull();
    expect(toggleTool("draw", "draw")).toBeNull();
  });

  it("swaps to the other tool, so only one is ever on", () => {
    expect(toggleTool("draw", "pointer")).toBe("pointer");
    expect(toggleTool("pointer", "draw")).toBe("draw");
  });
});

describe("isPointerShortcut", () => {
  const plain = {
    key: "p",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
  };

  it("matches a plain p in either case", () => {
    expect(isPointerShortcut(plain)).toBe(true);
    expect(isPointerShortcut({ ...plain, key: "P" })).toBe(true);
  });

  it("leaves modified and held presses to the browser", () => {
    expect(isPointerShortcut({ ...plain, ctrlKey: true })).toBe(false);
    expect(isPointerShortcut({ ...plain, metaKey: true })).toBe(false);
    expect(isPointerShortcut({ ...plain, altKey: true })).toBe(false);
    expect(isPointerShortcut({ ...plain, repeat: true })).toBe(false);
  });

  it("ignores the drawing and transport keys", () => {
    for (const key of ["d", "w", "l", "j", " ", "ArrowRight", "Escape"]) {
      expect(isPointerShortcut({ ...plain, key })).toBe(false);
    }
  });
});
