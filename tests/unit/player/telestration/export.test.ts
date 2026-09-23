import { afterEach, describe, expect, it, vi } from "vitest";

import {
  renderStill,
  StillExportFailure,
  stillFileName,
} from "@/features/player/telestration/export";

const palette = {
  pens: { red: "#f00", yellow: "#ff0", blue: "#00f", white: "#fff" },
  halo: "#000",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stillFileName", () => {
  it("slugs a quarter clock into a safe file name", () => {
    expect(stillFileName("V2 12:04")).toBe("standbild-v2-12-04.png");
  });

  it("slugs a plain game clock", () => {
    expect(stillFileName("1:02:03")).toBe("standbild-1-02-03.png");
  });

  it("falls back to a bare name when the clock is empty", () => {
    expect(stillFileName("")).toBe("standbild.png");
  });
});

function videoOfSize(width: number, height: number): HTMLVideoElement {
  const video = document.createElement("video");
  Object.defineProperty(video, "videoWidth", { value: width });
  Object.defineProperty(video, "videoHeight", { value: height });
  return video;
}

/** A 2D context whose every method is a no-op, so the renderer can run in jsdom. */
function stubContext(): void {
  const ctx = new Proxy({}, { get: () => vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
}

describe("renderStill", () => {
  it("refuses while no frame is decoded yet", async () => {
    await expect(renderStill(videoOfSize(0, 0), [], palette)).rejects.toEqual(
      new StillExportFailure("no-frame"),
    );
  });

  it("renders the frame at the video's native size", async () => {
    stubContext();
    const png = new Blob(["png"], { type: "image/png" });
    let size: [number, number] = [0, 0];
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (this: HTMLCanvasElement, done: BlobCallback) {
        size = [this.width, this.height];
        done(png);
      },
    );

    await expect(
      renderStill(videoOfSize(1920, 1080), [], palette),
    ).resolves.toBe(png);
    expect(size).toEqual([1920, 1080]);
  });

  it("reports a media host that forbids reading the pixels", async () => {
    stubContext();
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(() => {
      throw new DOMException("tainted", "SecurityError");
    });

    await expect(
      renderStill(videoOfSize(1280, 720), [], palette),
    ).rejects.toEqual(new StillExportFailure("blocked"));
  });
});
