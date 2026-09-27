/**
 * `POST /api/app/v1/clips/{id}/file` - hand a finished upload to the clip
 * worker as the file of a clip the Mac cut (ADR 0013, Mac plan S5): `{
 * uploadId, tagVersion, cutStartS }`, the tag version the Mac cut from and
 * the game time at clip-file time 0 it recorded.
 *
 * `202` with the clip, now `processing`: the worker checks the file with
 * ffprobe, moves it into the served clips and marks the clip `ready` (or
 * `failed`). A retry answers `202` again. A tag that moved past `tagVersion`
 * is `409` with the tag as it is now (its version also as `ETag`), so the Mac
 * re-cuts only when the window changed; the upload stays and can be handed
 * off again with the new version. `409` also answers an upload with bytes
 * missing (naming its offset), one already handed off, and a clip that is not
 * waiting for a file; `404` an unknown clip or upload, `422` an upload for
 * another clip, a clip the server cuts, or a file start that does not fit the
 * tag. Only the Mac's device token reaches this route.
 */
import {
  appJson,
  appUnauthorized,
  appVersionGate,
  versionConflict,
} from "@/features/app-api/responses";
import { isUuid } from "@/features/clips/validation";
import { handOffClipFile } from "@/features/uploads/queries";
import { parseClipFileHandoff } from "@/features/uploads/validation";
import { getDeviceSession } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  { params }: Context,
): Promise<Response> {
  const gate = appVersionGate(request);
  if (gate) return gate;
  const session = await getDeviceSession(request);
  if (!session) return appUnauthorized();

  const { id: rawId } = await params;
  if (!isUuid(rawId)) {
    return appJson({ error: "id must be a valid clip id" }, 400);
  }
  const id = rawId.toLowerCase();
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return appJson({ error: "invalid JSON body" }, 400);
  }
  const parsed = parseClipFileHandoff(raw);
  if (!parsed.ok) return appJson({ error: parsed.error }, 400);

  try {
    const outcome = await handOffClipFile(id, parsed.value, session.coach.id);
    switch (outcome.kind) {
      case "accepted":
        return appJson({ clip: { id, status: outcome.clipStatus } }, 202);
      case "not_found":
        return appJson({ error: "clip not found" }, 404);
      case "upload_not_found":
        return appJson({ error: "upload not found" }, 404);
      case "not_mac":
        return appJson(
          { error: "clip belongs to a game the server cuts" },
          422,
        );
      case "wrong_target":
        return appJson({ error: "upload belongs to another clip" }, 422);
      case "bad_cut_start":
        return appJson(
          { error: "cutStartS does not fit the tag's start" },
          422,
        );
      case "upload_used":
        return appJson(
          { error: "upload was handed off already", status: outcome.status },
          409,
        );
      case "incomplete":
        return appJson(
          { error: "upload is incomplete", offset: outcome.receivedBytes },
          409,
        );
      case "tag_moved":
        return versionConflict({ tag: outcome.tag }, outcome.tag.version);
      case "clip_busy":
        return appJson(
          {
            error: "clip is not waiting for a file",
            clip: { id, status: outcome.clipStatus },
          },
          409,
        );
    }
  } catch (cause) {
    console.error("failed to hand off a clip file", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}
