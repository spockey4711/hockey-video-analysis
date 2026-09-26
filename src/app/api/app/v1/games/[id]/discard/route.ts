/**
 * `POST /api/app/v1/games/{id}/discard` - discard a game under review (ADR
 * 0013, Mac plan S4) through the web review's query: the game and everything
 * hanging off it go, its video files are never touched, and its folder row
 * stays so the folder is not imported again. Answers `204`, also for a game
 * that is already gone (a retry), and `409` with its fields for an accepted
 * game, which is never deleted here.
 */
import { getGameFields } from "@/features/app-api/queries";
import {
  appEmpty,
  appJson,
  appUnauthorized,
  appVersionGate,
} from "@/features/app-api/responses";
import { isUuid } from "@/features/clips/validation";
import { discardImportedGame } from "@/features/games/queries";
import { getApiSession } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(
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
    const { deleted } = await discardImportedGame(id);
    if (deleted) return appEmpty(204);
    const game = await getGameFields(id);
    if (!game) return appEmpty(204);
    return appJson({ error: "game is not under review", game }, 409);
  } catch (cause) {
    console.error("failed to discard a game", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}
