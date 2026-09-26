/**
 * `POST /api/app/v1/games/{id}/accept` - accept a game under review (ADR 0013,
 * Mac plan S4) with a title, an optional opponent and a date, through the same
 * rules and query as the web review's "Übernehmen". Answers `200` with the
 * game's fields. A retry of an accept that already went through answers `200`
 * too; a game accepted with other values, or never under review, is `409`
 * with its fields, and a game that is gone `404`.
 */
import { getGameFields } from "@/features/app-api/queries";
import {
  appJson,
  appUnauthorized,
  appVersionGate,
} from "@/features/app-api/responses";
import { parseGameAccept } from "@/features/app-api/validation";
import { isUuid } from "@/features/clips/validation";
import { isUnnamedGame } from "@/features/games/format";
import { acceptImportedGame } from "@/features/games/queries";
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
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return appJson({ error: "invalid JSON body" }, 400);
  }
  const parsed = parseGameAccept(raw);
  if (!parsed.ok) return appJson({ error: parsed.error }, 400);
  const review = parsed.value;

  try {
    const { updated } = await acceptImportedGame(id, review);
    const game = await getGameFields(id);
    if (!game) return appJson({ error: "game not found" }, 404);
    const retried =
      !isUnnamedGame(game.title) &&
      game.title === review.title &&
      game.opponent === review.opponent &&
      game.playedOn === review.playedOn;
    if (updated || retried) return appJson({ game }, 200);
    return appJson({ error: "game is not under review", game }, 409);
  } catch (cause) {
    console.error("failed to accept a game", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}
