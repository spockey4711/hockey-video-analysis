/**
 * Response bodies and headers shared by the upload routes (Mac plan S5).
 */
import { UPLOAD_LENGTH_HEADER, UPLOAD_OFFSET_HEADER } from "./limits";
import type { UploadState } from "./queries";

import { appJson } from "@/features/app-api/responses";

/** An upload as the Mac reads it: built from explicit fields only. */
export function uploadBody(upload: UploadState) {
  return {
    id: upload.id,
    sizeBytes: upload.sizeBytes,
    offset: upload.receivedBytes,
    status: upload.status,
    expiresAt: upload.expiresAt.toISOString(),
  };
}

/** The offset and length headers of an upload. */
export function offsetHeaders(upload: UploadState): Record<string, string> {
  return {
    [UPLOAD_OFFSET_HEADER]: String(upload.receivedBytes),
    [UPLOAD_LENGTH_HEADER]: String(upload.sizeBytes),
  };
}

/** The answer while no staging directory is configured. */
export function uploadsOff(): Response {
  return appJson({ error: "uploads are not configured" }, 503);
}
