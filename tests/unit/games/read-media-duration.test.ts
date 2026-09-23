import { describe, expect, it, vi } from "vitest";

import {
  MediaDurationError,
  readMediaDuration,
} from "@/features/games/read-media-duration";

/** A jsdom video whose duration the test controls; jsdom never loads media. */
function fakeVideo(duration: number): HTMLVideoElement {
  const video = document.createElement("video");
  Object.defineProperty(video, "duration", { get: () => duration });
  video.load = vi.fn();
  return video;
}

describe("readMediaDuration", () => {
  it("resolves the length once the metadata has loaded", async () => {
    const video = fakeVideo(1218.4);
    const result = readMediaDuration(
      "/media/GX010123.MP4",
      new AbortController().signal,
      () => video,
    );

    expect(video.preload).toBe("metadata");
    expect(video.getAttribute("src")).toBe("/media/GX010123.MP4");
    video.dispatchEvent(new Event("loadedmetadata"));

    await expect(result).resolves.toBe(1218.4);
    // Released so the browser drops the pending request.
    expect(video.hasAttribute("src")).toBe(false);
    expect(video.load).toHaveBeenCalled();
  });

  it("rejects when the file does not load", async () => {
    const video = fakeVideo(Number.NaN);
    const result = readMediaDuration(
      "/media/missing.MP4",
      new AbortController().signal,
      () => video,
    );

    video.dispatchEvent(new Event("error"));

    await expect(result).rejects.toBeInstanceOf(MediaDurationError);
    expect(video.hasAttribute("src")).toBe(false);
  });

  it("rejects a length that is not finite and positive", async () => {
    const video = fakeVideo(Number.POSITIVE_INFINITY);
    const result = readMediaDuration(
      "/media/live",
      new AbortController().signal,
      () => video,
    );

    video.dispatchEvent(new Event("loadedmetadata"));

    await expect(result).rejects.toBeInstanceOf(MediaDurationError);
  });

  it("rejects with the abort reason and releases the element", async () => {
    const video = fakeVideo(10);
    const controller = new AbortController();
    const result = readMediaDuration(
      "/media/a.MP4",
      controller.signal,
      () => video,
    );

    controller.abort(new Error("path changed"));

    await expect(result).rejects.toThrow("path changed");
    expect(video.hasAttribute("src")).toBe(false);
  });

  it("does not create an element for an already aborted signal", async () => {
    const controller = new AbortController();
    controller.abort(new Error("gone"));
    const createVideo = vi.fn(() => fakeVideo(10));

    await expect(
      readMediaDuration("/media/a.MP4", controller.signal, createVideo),
    ).rejects.toThrow("gone");
    expect(createVideo).not.toHaveBeenCalled();
  });
});
