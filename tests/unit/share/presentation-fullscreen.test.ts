import { afterEach, describe, expect, it, vi } from "vitest";

import {
  enterFullscreen,
  exitFullscreen,
  isFullscreenActive,
  isFullscreenSupported,
} from "@/features/share/presentation/fullscreen";

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "fullscreenElement");
});

describe("isFullscreenSupported", () => {
  it("is false for null or an element without requestFullscreen", () => {
    expect(isFullscreenSupported(null)).toBe(false);
    const el = document.createElement("div");
    expect(isFullscreenSupported(el)).toBe(false);
  });

  it("is true when the element exposes requestFullscreen", () => {
    const el = document.createElement("div");
    el.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    expect(isFullscreenSupported(el)).toBe(true);
  });
});

describe("enterFullscreen", () => {
  it("requests fullscreen on a supported element", async () => {
    const el = document.createElement("div");
    const request = vi.fn().mockResolvedValue(undefined);
    el.requestFullscreen = request;
    await enterFullscreen(el);
    expect(request).toHaveBeenCalledOnce();
  });

  it("does nothing and never throws when unsupported", async () => {
    await expect(enterFullscreen(null)).resolves.toBeUndefined();
  });

  it("swallows a rejected request", async () => {
    const el = document.createElement("div");
    el.requestFullscreen = vi.fn().mockRejectedValue(new Error("no gesture"));
    await expect(enterFullscreen(el)).resolves.toBeUndefined();
  });
});

describe("exitFullscreen", () => {
  it("exits only when an element owns the viewport", async () => {
    const exit = vi.fn().mockResolvedValue(undefined);
    document.exitFullscreen = exit;

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    await exitFullscreen();
    expect(exit).not.toHaveBeenCalled();

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.createElement("div"),
    });
    await exitFullscreen();
    expect(exit).toHaveBeenCalledOnce();
  });
});

describe("isFullscreenActive", () => {
  it("tracks document.fullscreenElement", () => {
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    expect(isFullscreenActive()).toBe(false);

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.createElement("div"),
    });
    expect(isFullscreenActive()).toBe(true);
  });
});
