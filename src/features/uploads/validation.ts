/**
 * Parse functions for the Mac app's upload requests (Mac plan S5) - pure, so
 * the rules are unit-tested without a request. Error strings are for the
 * Mac's logs; the Mac shows its own copy to the coach.
 */
import { MAX_CLIP_UPLOAD_BYTES } from "./limits";

import { isUuid } from "@/features/clips/validation";

/** A new upload: a clip file of `sizeBytes` for the clip `clipId`. */
export interface UploadCreation {
  readonly purpose: "clip";
  readonly clipId: string;
  readonly sizeBytes: number;
}

/** A finished upload handed to the clip worker as the file of a clip. */
export interface ClipFileHandoff {
  readonly uploadId: string;
  /** The version of the clip's tag the Mac cut the file from. */
  readonly tagVersion: number;
  /** The game time at clip-file time 0 the Mac recorded (ADR 0011). */
  readonly cutStartS: number;
}

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly tooLarge?: true };

// Versions are Postgres integers.
const MAX_VERSION = 2_147_483_647;

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

/**
 * Validate `POST /api/app/v1/uploads`'s body: `{ purpose, targetId,
 * sizeBytes }`. A size over the cap is flagged `tooLarge`, which the route
 * answers `413`.
 */
export function parseUploadCreation(raw: unknown): ParseResult<UploadCreation> {
  if (!isRecord(raw)) return { ok: false, error: "body must be a JSON object" };
  const { purpose, targetId, sizeBytes } = raw;
  if (purpose !== "clip") return { ok: false, error: "purpose must be clip" };
  if (!isUuid(targetId)) {
    return { ok: false, error: "targetId must be a valid clip id" };
  }
  if (
    typeof sizeBytes !== "number" ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 1
  ) {
    return { ok: false, error: "sizeBytes must be a positive whole number" };
  }
  if (sizeBytes > MAX_CLIP_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `sizeBytes must be at most ${MAX_CLIP_UPLOAD_BYTES}`,
      tooLarge: true,
    };
  }
  return {
    ok: true,
    value: { purpose, clipId: targetId.toLowerCase(), sizeBytes },
  };
}

/**
 * Parse a chunk's `Upload-Offset` or `Content-Length` header: a whole number
 * of bytes, or null when it is missing or anything else.
 */
export function parseByteCount(raw: string | null): number | null {
  if (raw === null || !/^(0|[1-9]\d{0,15})$/.test(raw.trim())) return null;
  const count = Number(raw.trim());
  return Number.isSafeInteger(count) ? count : null;
}

/**
 * Validate `POST /api/app/v1/clips/{id}/file`'s body: `{ uploadId,
 * tagVersion, cutStartS }`.
 */
export function parseClipFileHandoff(
  raw: unknown,
): ParseResult<ClipFileHandoff> {
  if (!isRecord(raw)) return { ok: false, error: "body must be a JSON object" };
  const { uploadId, tagVersion, cutStartS } = raw;
  if (!isUuid(uploadId)) {
    return { ok: false, error: "uploadId must be a valid upload id" };
  }
  if (
    typeof tagVersion !== "number" ||
    !Number.isSafeInteger(tagVersion) ||
    tagVersion < 1 ||
    tagVersion > MAX_VERSION
  ) {
    return { ok: false, error: "tagVersion must be a tag version" };
  }
  if (
    typeof cutStartS !== "number" ||
    !Number.isFinite(cutStartS) ||
    cutStartS < 0
  ) {
    return {
      ok: false,
      error: "cutStartS must be a game time in seconds",
    };
  }
  return {
    ok: true,
    value: { uploadId: uploadId.toLowerCase(), tagVersion, cutStartS },
  };
}
