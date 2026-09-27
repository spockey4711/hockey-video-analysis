/**
 * One resumable upload from the Mac app (ADR 0013, Mac plan S5).
 *
 * `PATCH` appends one chunk: the raw bytes as `application/octet-stream`, with
 * `Upload-Offset` naming where they start and `Content-Length` their size (at
 * most `MAX_UPLOAD_CHUNK_BYTES`, never past the announced size). The offset
 * must be the one the server holds, else `409` names it; success is `204` with
 * the new offset in `Upload-Offset`. Bytes that landed before a broken-off
 * body count, so the Mac resumes from wherever the server got to. The first
 * chunk must open an MP4 file (`415` otherwise).
 *
 * `HEAD` answers the current offset and size in `Upload-Offset` and
 * `Upload-Length`: where a Mac that lost its connection resumes.
 *
 * `DELETE` abandons an upload with its staged bytes (`204`, also for one
 * already gone); an upload the clip worker holds stays (`409`).
 *
 * Only the Mac's device token reaches these routes, and only for its coach's
 * own uploads; any other id is `404`.
 */
import {
  appEmpty,
  appJson,
  appUnauthorized,
  appVersionGate,
} from "@/features/app-api/responses";
import { isUuid } from "@/features/clips/validation";
import {
  MAX_UPLOAD_CHUNK_BYTES,
  UPLOAD_CHUNK_CONTENT_TYPE,
  UPLOAD_OFFSET_HEADER,
} from "@/features/uploads/limits";
import {
  advanceUpload,
  deleteUpload,
  readUpload,
} from "@/features/uploads/queries";
import { offsetHeaders, uploadsOff } from "@/features/uploads/responses";
import {
  hasMp4Signature,
  MP4_SIGNATURE_BYTES,
  readFileHead,
  removeStagingFile,
  stagingFilePath,
  stagingRootFromEnv,
  writeChunk,
} from "@/features/uploads/staging";
import { parseByteCount } from "@/features/uploads/validation";
import { getDeviceSession } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

/** The checks every upload route shares: the gate, the token, the id. */
async function authorize(
  request: Request,
  params: Context["params"],
): Promise<
  | { readonly ok: true; readonly coachId: string; readonly id: string }
  | { readonly ok: false; readonly response: Response }
> {
  const gate = appVersionGate(request);
  if (gate) return { ok: false, response: gate };
  const session = await getDeviceSession(request);
  if (!session) return { ok: false, response: appUnauthorized() };
  const { id } = await params;
  if (!isUuid(id)) {
    return {
      ok: false,
      response: appJson({ error: "id must be a valid upload id" }, 400),
    };
  }
  return { ok: true, coachId: session.coach.id, id: id.toLowerCase() };
}

const notFound = () => appJson({ error: "upload not found" }, 404);

export async function PATCH(
  request: Request,
  { params }: Context,
): Promise<Response> {
  const auth = await authorize(request, params);
  if (!auth.ok) return auth.response;
  const root = stagingRootFromEnv();
  if (!root) return uploadsOff();

  const contentType = request.headers.get("content-type")?.split(";")[0];
  if (contentType?.trim().toLowerCase() !== UPLOAD_CHUNK_CONTENT_TYPE) {
    return appJson(
      { error: `chunks must be sent as ${UPLOAD_CHUNK_CONTENT_TYPE}` },
      415,
    );
  }
  const offset = parseByteCount(request.headers.get(UPLOAD_OFFSET_HEADER));
  if (offset === null) {
    return appJson({ error: `${UPLOAD_OFFSET_HEADER} is required` }, 400);
  }
  const length = parseByteCount(request.headers.get("content-length"));
  if (length === null) {
    return appJson({ error: "Content-Length is required" }, 411);
  }
  if (length > MAX_UPLOAD_CHUNK_BYTES) {
    return appJson(
      { error: `a chunk must be at most ${MAX_UPLOAD_CHUNK_BYTES} bytes` },
      413,
    );
  }

  try {
    const upload = await readUpload(auth.id, auth.coachId);
    if (!upload) return notFound();
    if (upload.status !== "receiving") {
      return appJson(
        { error: "upload is not receiving", status: upload.status },
        409,
      );
    }
    if (offset !== upload.receivedBytes) {
      return appJson(
        { error: "offset mismatch", offset: upload.receivedBytes },
        409,
        offsetHeaders(upload),
      );
    }
    if (length > upload.sizeBytes - offset) {
      return appJson({ error: "chunk runs past the upload's size" }, 413);
    }

    const file = stagingFilePath(root, upload.id);
    const chunk = await writeChunk(file, offset, request.body, length);
    if (chunk.overflow) {
      return appJson({ error: "body is longer than Content-Length" }, 400);
    }
    if (offset === 0 && chunk.written >= MP4_SIGNATURE_BYTES) {
      if (!hasMp4Signature(await readFileHead(file, MP4_SIGNATURE_BYTES))) {
        return appJson({ error: "the file is not an MP4 file" }, 415);
      }
    }
    const advanced =
      chunk.written === 0
        ? upload
        : await advanceUpload(
            upload.id,
            auth.coachId,
            offset,
            offset + chunk.written,
          );
    if (!advanced) {
      const current = await readUpload(auth.id, auth.coachId);
      if (!current) return notFound();
      return appJson(
        { error: "offset mismatch", offset: current.receivedBytes },
        409,
        offsetHeaders(current),
      );
    }
    if (chunk.interrupted || chunk.written < length) {
      return appJson(
        { error: "chunk ended early", offset: advanced.receivedBytes },
        400,
        offsetHeaders(advanced),
      );
    }
    return appEmpty(204, offsetHeaders(advanced));
  } catch (cause) {
    console.error("failed to store an upload chunk", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}

export async function HEAD(
  request: Request,
  { params }: Context,
): Promise<Response> {
  const auth = await authorize(request, params);
  if (!auth.ok) return appEmpty(auth.response.status);
  try {
    const upload = await readUpload(auth.id, auth.coachId);
    if (!upload) return appEmpty(404);
    return appEmpty(200, offsetHeaders(upload));
  } catch (cause) {
    console.error("failed to read an upload", cause);
    return appEmpty(500);
  }
}

export async function DELETE(
  request: Request,
  { params }: Context,
): Promise<Response> {
  const auth = await authorize(request, params);
  if (!auth.ok) return auth.response;
  const root = stagingRootFromEnv();
  if (!root) return uploadsOff();
  try {
    const outcome = await deleteUpload(auth.id, auth.coachId);
    if (outcome === "submitted") {
      return appJson({ error: "the clip worker has this upload" }, 409);
    }
    if (outcome === "deleted") await removeStagingFile(root, auth.id);
    return appEmpty(204);
  } catch (cause) {
    console.error("failed to abandon an upload", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}
