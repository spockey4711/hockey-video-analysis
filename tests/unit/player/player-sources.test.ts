import { describe, expect, it } from "vitest";

import {
  resolveSourceUrl,
  toPlayerSources,
} from "@/features/player/player-sources";

describe("resolveSourceUrl", () => {
  it("returns the stored path unchanged when no base URL is set", () => {
    expect(resolveSourceUrl("/videos/game1/chapter1.mp4", undefined)).toBe(
      "/videos/game1/chapter1.mp4",
    );
    expect(resolveSourceUrl("chapter1.mp4", "")).toBe("chapter1.mp4");
  });

  it("joins the base URL and path with a single separator", () => {
    expect(resolveSourceUrl("game1/ch1.mp4", "https://media.test/hockey")).toBe(
      "https://media.test/hockey/game1/ch1.mp4",
    );
  });

  it("does not double up separators from a trailing or leading slash", () => {
    expect(
      resolveSourceUrl("/game1/ch1.mp4", "https://media.test/hockey/"),
    ).toBe("https://media.test/hockey/game1/ch1.mp4");
  });

  it("url-encodes path segments so spaces and unicode stay valid", () => {
    expect(
      resolveSourceUrl("HSV vs TTK/1. Halbzeit.mp4", "https://media.test"),
    ).toBe("https://media.test/HSV%20vs%20TTK/1.%20Halbzeit.mp4");
  });
});

describe("toPlayerSources", () => {
  it("maps chapters to sources, preserving order and duration", () => {
    const chapters = [
      { filePath: "a.mp4", durationS: 100 },
      { filePath: "b.mp4", durationS: 150.5 },
    ];
    expect(
      toPlayerSources(chapters, { baseUrl: "https://media.test" }),
    ).toEqual([
      { src: "https://media.test/a.mp4", durationS: 100 },
      { src: "https://media.test/b.mp4", durationS: 150.5 },
    ]);
  });

  it("prefers the proxy root when one is configured, keeping duration", () => {
    const chapters = [{ filePath: "game1/ch1.mp4", durationS: 42 }];
    expect(
      toPlayerSources(chapters, {
        baseUrl: "https://media.test/full",
        proxyBaseUrl: "https://media.test/proxy",
      }),
    ).toEqual([
      {
        src: "https://media.test/proxy/game1/ch1.mp4",
        durationS: 42,
      },
    ]);
  });

  it("falls back to the full-res base URL when the proxy root is unset or empty", () => {
    const chapters = [{ filePath: "game1/ch1.mp4", durationS: 42 }];
    const expected = [
      {
        src: "https://media.test/full/game1/ch1.mp4",
        durationS: 42,
      },
    ];
    expect(
      toPlayerSources(chapters, { baseUrl: "https://media.test/full" }),
    ).toEqual(expected);
    expect(
      toPlayerSources(chapters, {
        baseUrl: "https://media.test/full",
        proxyBaseUrl: "   ",
      }),
    ).toEqual(expected);
  });

  it("returns an empty list for a game with no chapters", () => {
    expect(toPlayerSources([], { baseUrl: "https://media.test" })).toEqual([]);
  });
});
