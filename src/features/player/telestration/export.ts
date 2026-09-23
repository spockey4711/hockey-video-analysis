/**
 * The still export (P2-10): the paused video frame at its native resolution with
 * the coach's drawing burned in, as a PNG the browser downloads. Entirely
 * client-side; burning a drawing into a shared clip is a pipeline job, not this.
 */
import { drawStrokes, type DrawPalette } from "./render";
import type { Stroke } from "./state";

/** Why a still could not be produced, mapped to copy by the toolbar. */
export type StillExportError = "no-frame" | "blocked" | "failed";

export class StillExportFailure extends Error {
  constructor(readonly reason: StillExportError) {
    super(`Still export failed: ${reason}`);
    this.name = "StillExportFailure";
  }
}

/**
 * Download name for a still taken at the given clock readout, e.g.
 * `V2 12:04` -> `standbild-v2-12-04.png`. Anything but letters and digits
 * becomes a single hyphen so the name is safe on every file system.
 */
export function stillFileName(clock: string): string {
  const slug = clock
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `standbild-${slug}.png` : "standbild.png";
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new StillExportFailure("no-frame"));
      }, "image/png");
    } catch (error) {
      // A frame from a media host without CORS taints the canvas; reading it
      // back throws a SecurityError rather than leaking the pixels.
      reject(
        error instanceof DOMException && error.name === "SecurityError"
          ? new StillExportFailure("blocked")
          : error,
      );
    }
  });
}

/**
 * Render the current frame of `video` with `strokes` on top, at the video's
 * native size. Rejects with a {@link StillExportFailure} when there is no
 * decoded frame yet or the media host forbids reading the pixels.
 */
export function renderStill(
  video: HTMLVideoElement,
  strokes: readonly Stroke[],
  palette: DrawPalette,
): Promise<Blob> {
  const { videoWidth: width, videoHeight: height } = video;
  if (width === 0 || height === 0) {
    return Promise.reject(new StillExportFailure("no-frame"));
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new StillExportFailure("failed"));
  ctx.drawImage(video, 0, 0, width, height);
  drawStrokes(ctx, strokes, { x: 0, y: 0, width, height }, palette);
  return canvasToPng(canvas);
}

const REVOKE_DELAY_MS = 10_000;

/** Hand a blob to the browser as a file download. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking right away can cancel the download in some browsers; a short grace
  // period lets it start, then the in-memory image is released.
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
