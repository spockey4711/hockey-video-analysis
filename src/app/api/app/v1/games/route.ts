/**
 * `POST /api/app/v1/games` - register a Mac game (ADR 0013, Mac plan S4): a
 * game under review with its chapters (`<folder>/<file>` paths, sizes and
 * `duration_s`) and a client-made id. The game's `media_home` is `mac`, so the
 * Mac cuts its clips, and its folder is recorded for the Drive importer.
 *
 * Idempotent: `201` with the game's snapshot when it is new, `200` with the
 * stored snapshot when the same registration was stored before, and `409`
 * when the id belongs to another game or the folder is already recorded.
 */
import { registerMacGame } from "@/features/app-api/games";
import { getGameSnapshot } from "@/features/app-api/queries";
import {
  appJson,
  appUnauthorized,
  appVersionGate,
} from "@/features/app-api/responses";
import { parseGameRegistration } from "@/features/app-api/validation";
import { getApiSession } from "@/lib/auth";

export async function POST(request: Request): Promise<Response> {
  const gate = appVersionGate(request);
  if (gate) return gate;
  const session = await getApiSession(request);
  if (!session) return appUnauthorized();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return appJson({ error: "invalid JSON body" }, 400);
  }
  const parsed = parseGameRegistration(raw);
  if (!parsed.ok) return appJson({ error: parsed.error }, 400);

  try {
    const outcome = await registerMacGame(parsed.value, session.coach.id);
    switch (outcome) {
      case "id_taken":
        return appJson({ error: "id belongs to another game" }, 409);
      case "folder_taken":
        return appJson({ error: "folder is already recorded" }, 409);
      case "created":
      case "exists": {
        const snapshot = await getGameSnapshot(parsed.value.id);
        if (!snapshot) return appJson({ error: "game not found" }, 404);
        return appJson(snapshot, outcome === "created" ? 201 : 200);
      }
    }
  } catch (cause) {
    console.error("failed to register a Mac game", cause);
    return appJson({ error: "unexpected error" }, 500);
  }
}
