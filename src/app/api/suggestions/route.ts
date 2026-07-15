/**
 * `GET /api/suggestions?gameId=...` - list a game's double-whistle candidates for
 * review (P1-5). Coach-only: whistle candidates are part of the private team
 * workspace and only a coach reviews them, so the client never touches the DB
 * directly (see the stack notes). Candidates are read as a whole set in
 * game-time order; the coach confirms or rejects each via
 * `PATCH /api/suggestions/[id]`.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import { listWhistleCandidates } from "@/features/suggestions/queries";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request): Promise<Response> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const gameId = new URL(request.url).searchParams.get("gameId");
  if (!gameId || !UUID_RE.test(gameId)) {
    return NextResponse.json(
      { error: "gameId must be a valid game id" },
      { status: 400 },
    );
  }

  const candidates = await listWhistleCandidates(gameId);
  return NextResponse.json({ candidates });
}
