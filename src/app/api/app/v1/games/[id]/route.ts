/**
 * `GET /api/app/v1/games/{id}` - a game's snapshot for the Mac app (ADR 0013,
 * Mac plan S3): the game with its versions and revision, its chapters, its
 * quarters and its tags with players, visibility and clip status. A game that
 * does not exist, or that the importer still hides, is `404`.
 *
 * `PATCH /api/app/v1/games/{id}` changes the game's title, opponent or date
 * (Mac plan S4). It needs the game version it started from in `If-Match`
 * (`428` without one): a game that moved since is left alone and answered
 * `409` with its fields. A game under review is named by accepting it, and an
 * accepted game keeps its date; such a patch is `422`. Success answers `200`
 * with the game's fields and the new version as `ETag`.
 */
import { updateGameFields } from "@/features/app-api/games";
import { entityTag } from "@/features/app-api/if-match";
import { getGameSnapshot } from "@/features/app-api/queries";
import {
  appJson,
  appUnauthorized,
  appVersionGate,
  readBaseVersion,
  versionConflict,
} from "@/features/app-api/responses";
import { parseGameFieldsPatch } from "@/features/app-api/validation";
import { isUuid } from "@/features/clips/validation";
import { getApiSession } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  { params }: Context,
): Promise<Response> {
  const gate = appVersionGate(request);
  if (gate) return gate;
  if (!(await getApiSession(request))) return appUnauthorized();

  const { id } = await params;
  if (!isUuid(id)) {
    return appJson({ error: "id must be a valid game id" }, 400);
  }

  try {
    const snapshot = await getGameSnapshot(id);
    if (!snapshot) return appJson({ error: "game not found" }, 404);
    return appJson(snapshot, 200);
  } catch (cause) {
    console.error("failed to read a game snapshot", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: Context,
): Promise<Response> {
  const gate = appVersionGate(request);
  if (gate) return gate;
  if (!(await getApiSession(request))) return appUnauthorized();

  const { id } = await params;
  if (!isUuid(id)) {
    return appJson({ error: "id must be a valid game id" }, 400);
  }
  const baseVersion = readBaseVersion(request);
  if (baseVersion instanceof Response) return baseVersion;
  if (baseVersion === null) {
    return appJson(
      { error: "If-Match with the game version is required" },
      428,
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return appJson({ error: "invalid JSON body" }, 400);
  }
  const parsed = parseGameFieldsPatch(raw);
  if (!parsed.ok) return appJson({ error: parsed.error }, 400);

  try {
    const outcome = await updateGameFields(id, parsed.value, baseVersion);
    switch (outcome.kind) {
      case "not_found":
        return appJson({ error: "game not found" }, 404);
      case "invalid":
        return appJson({ error: outcome.error }, 422);
      case "conflict":
        return versionConflict({ game: outcome.game }, outcome.game.version);
      case "updated":
        return appJson({ game: outcome.game }, 200, {
          ETag: entityTag(outcome.game.version),
        });
    }
  } catch (cause) {
    console.error("failed to update a game", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}
