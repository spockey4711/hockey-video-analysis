/**
 * `GET /api/tactics/scenes/[id]` - one saved tactics scene (ADR 0010), for
 * opening it on the board in presentation mode. Returns `{ id, name, scene,
 * roster }` with the document as `parseScene` reads it back and the roster
 * players its tokens link to (id, name, shirt number), so the coach's board
 * can show their names. Nothing else of the roster goes out.
 *
 * Coach-only, like the rest of the tactics board: scenes have no share link,
 * so a viewer of a collection link without a coach session never reaches one.
 * A malformed id is a 400, and an unknown scene or one that no longer parses
 * a 404.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import { getScene, listBoardRoster } from "@/features/tactics/queries";
import { isValidSceneId } from "@/features/tactics/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  { params }: Context,
): Promise<Response> {
  if (!(await getCurrentCoach())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!isValidSceneId(id)) {
    return NextResponse.json(
      { error: "id must be a valid scene id" },
      { status: 400 },
    );
  }
  const scene = await getScene(id);
  if (!scene) {
    return NextResponse.json({ error: "scene not found" }, { status: 404 });
  }
  const linked = new Set(
    scene.scene.tokens.flatMap((token) =>
      token.kind === "player" && token.playerId ? [token.playerId] : [],
    ),
  );
  const roster =
    linked.size > 0
      ? (await listBoardRoster()).filter((player) => linked.has(player.id))
      : [];
  return NextResponse.json({ ...scene, roster });
}
