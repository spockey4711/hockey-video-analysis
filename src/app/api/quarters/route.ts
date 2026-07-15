/**
 * `GET /api/quarters?gameId=...` and `PUT /api/quarters` - read and set a game's
 * quarter boundaries (P1-4). Coach-only: quarters are part of the private team
 * workspace and only a coach sets them, so the client never touches the DB
 * directly (see the stack notes). `PUT` replaces the whole set after validating
 * the untrusted body.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import { listQuarters, replaceQuarters } from "@/features/quarters/queries";
import { parseQuartersInput } from "@/features/quarters/validation";

/** Postgres foreign-key-violation code, thrown when `gameId` has no game. */
const PG_FOREIGN_KEY_VIOLATION = "23503";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isForeignKeyViolation(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === PG_FOREIGN_KEY_VIOLATION
  );
}

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

  const quarters = await listQuarters(gameId);
  return NextResponse.json({ quarters });
}

export async function PUT(request: Request): Promise<Response> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parseQuartersInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const quarters = await replaceQuarters(parsed.value);
    return NextResponse.json({ quarters });
  } catch (cause) {
    if (isForeignKeyViolation(cause)) {
      return NextResponse.json({ error: "game not found" }, { status: 400 });
    }
    console.error("failed to replace quarters", cause);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
