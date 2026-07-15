/**
 * `POST /api/ingest` - drop-a-folder game ingest (P2-9).
 *
 * The hockey-video-pipeline concatenates a game's ordered GoPro chapter files
 * and then calls this endpoint to register the assembled game. We auto-create a
 * `games` row plus its ordered `game_sources` in a needs-a-name state (empty
 * title, no opponent, no coach author) and surface it in the games list; the
 * coach only has to name it. Machine-to-machine, so it authenticates with the
 * shared `INGEST_TOKEN` (Bearer) rather than a coach session - an unset token,
 * or any mismatch, is rejected as unauthorized.
 *
 * No whistle processing happens here: double-whistle detection is deliberately
 * out of the auto-ingest flow (see the backlog scope note).
 */
import { NextResponse } from "next/server";

import { parseIngestGame } from "@/features/games/ingest";
import {
  readBearerToken,
  verifyIngestToken,
} from "@/features/games/ingest-token";
import { createIngestedGame } from "@/features/games/queries";

export async function POST(request: Request): Promise<Response> {
  const bearer = readBearerToken(request.headers.get("authorization"));
  if (!verifyIngestToken(bearer)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parseIngestGame(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  let game: { id: string };
  try {
    game = await createIngestedGame(parsed.value);
  } catch {
    return NextResponse.json(
      { error: "could not register the game" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { id: game.id, status: "needs_name" },
    { status: 201 },
  );
}
