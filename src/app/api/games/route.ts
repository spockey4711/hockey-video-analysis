import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import { listGames } from "@/features/games";

/**
 * List games as JSON for client components (the convention is that client code
 * never queries the DB directly - it goes through a route handler). Coach-only:
 * games are a private team workspace, so an unauthenticated request is rejected.
 */
export async function GET() {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const games = await listGames();
  return NextResponse.json({ games });
}
