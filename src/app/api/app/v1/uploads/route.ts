/**
 * `POST /api/app/v1/uploads` - announce a resumable upload from the Mac app
 * (ADR 0013, Mac plan S5): `{ purpose: "clip", targetId, sizeBytes }` for the
 * file of a clip of a `mac` game. Answers `201` with the upload (its id, size,
 * offset 0 and expiry) and its URL in `Location`; the bytes follow as `PATCH`
 * chunks to that URL.
 *
 * Only the Mac's device token reaches this route. `413` refuses a size over
 * the cap, `404` an unknown clip and `422` a clip the server cuts itself;
 * `503` means the server has no staging directory, so uploads are off.
 */
import {
  appJson,
  appUnauthorized,
  appVersionGate,
} from "@/features/app-api/responses";
import { UPLOAD_OFFSET_HEADER } from "@/features/uploads/limits";
import { createClipUpload, deleteUpload } from "@/features/uploads/queries";
import { uploadBody, uploadsOff } from "@/features/uploads/responses";
import {
  createStagingFile,
  stagingRootFromEnv,
} from "@/features/uploads/staging";
import { parseUploadCreation } from "@/features/uploads/validation";
import { getDeviceSession } from "@/lib/auth";

export async function POST(request: Request): Promise<Response> {
  const gate = appVersionGate(request);
  if (gate) return gate;
  const session = await getDeviceSession(request);
  if (!session) return appUnauthorized();
  const root = stagingRootFromEnv();
  if (!root) return uploadsOff();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return appJson({ error: "invalid JSON body" }, 400);
  }
  const parsed = parseUploadCreation(raw);
  if (!parsed.ok) {
    return appJson({ error: parsed.error }, parsed.tooLarge ? 413 : 400);
  }

  try {
    const outcome = await createClipUpload(parsed.value, session.coach.id);
    switch (outcome.kind) {
      case "not_found":
        return appJson({ error: "clip not found" }, 404);
      case "not_mac":
        return appJson(
          { error: "clip belongs to a game the server cuts" },
          422,
        );
      case "created":
        break;
    }
    const { upload } = outcome;
    try {
      await createStagingFile(root, upload.id);
    } catch (cause) {
      await deleteUpload(upload.id, session.coach.id);
      throw cause;
    }
    return appJson(uploadBody(upload), 201, {
      Location: `/api/app/v1/uploads/${upload.id}`,
      [UPLOAD_OFFSET_HEADER]: String(upload.receivedBytes),
    });
  } catch (cause) {
    console.error("failed to start an upload", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}
