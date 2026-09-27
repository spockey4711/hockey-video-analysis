/**
 * The limits and headers of the Mac app's resumable uploads (ADR 0013, Mac
 * plan S5). A small subset of the tus idea: `POST` announces the upload and
 * its size, each `PATCH` appends one chunk at the offset the server holds, and
 * `HEAD` tells a Mac that lost its connection where to resume.
 */

/** The largest clip file the server takes: far above any tag window's cut. */
export const MAX_CLIP_UPLOAD_BYTES = 4 * 1024 ** 3;

/**
 * The largest body of one `PATCH`. The reverse proxy in front of the app must
 * allow at least this much per request (`docs/ops/vps-setup.md`).
 */
export const MAX_UPLOAD_CHUNK_BYTES = 32 * 1024 ** 2;

/**
 * How long an upload may sit without a new chunk before it is removed with its
 * staged bytes. Every chunk moves the expiry forward again.
 */
export const UPLOAD_IDLE_MS = 24 * 60 * 60 * 1000;

/** The response header naming how many bytes the server holds. */
export const UPLOAD_OFFSET_HEADER = "Upload-Offset";

/** The response header naming the upload's announced size. */
export const UPLOAD_LENGTH_HEADER = "Upload-Length";

/** The content type every chunk is sent as. */
export const UPLOAD_CHUNK_CONTENT_TYPE = "application/octet-stream";

/** When an upload touched at `now` expires. */
export function uploadExpiresAt(now: Date): Date {
  return new Date(now.getTime() + UPLOAD_IDLE_MS);
}
