/**
 * `GET /api/app/v1/games/{id}` - a game's snapshot for the Mac app (ADR 0013,
 * Mac plan S3): the game with its versions and revision, its chapters, its
 * quarters and its tags with players, visibility and clip status. A game that
 * does not exist, or that the importer still hides, is `404`.
 */
import { getGameSnapshot } from "@/features/app-api/queries";
import {
  appJson,
  appUnauthorized,
  appVersionGate,
} from "@/features/app-api/responses";
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
