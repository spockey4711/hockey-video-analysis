/**
 * `GET /api/quarters?gameId=...` and `PUT /api/quarters` - read and set a game's
 * quarter boundaries (P1-4). Coach-only: quarters are part of the private team
 * workspace and only a coach sets them, so the client never touches the DB
 * directly (see the stack notes). `PUT` replaces the whole set after validating
 * the untrusted body against the game's format (four quarters or two halves).
 *
 * The Mac app calls both with its bearer token; its `PUT` names the quarter
 * set's version it started from in `If-Match` (ADR 0013), and a set that has
 * moved since is left alone and answered `409` with the current set. The web
 * sends no header and saves without the check.
 */
import { NextResponse } from "next/server";

import { entityTag } from "@/features/app-api/if-match";
import { readBaseVersion, versionConflict } from "@/features/app-api/responses";
import { getGameFormat } from "@/features/game-format/queries";
import { listQuarters, replaceQuarters } from "@/features/quarters/queries";
import { parseQuartersInput } from "@/features/quarters/validation";
import { getApiSession } from "@/lib/auth";

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
  if (!(await getApiSession(request))) {
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
  if (!(await getApiSession(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const baseVersion = readBaseVersion(request);
  if (baseVersion instanceof Response) return baseVersion;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // The period count the set may hold is the game's format, so the game is
  // looked up first; an unknown or malformed id is a bad request either way.
  const gameId =
    typeof raw === "object" && raw !== null && "gameId" in raw
      ? String(raw.gameId)
      : "";
  if (!UUID_RE.test(gameId)) {
    return NextResponse.json(
      { error: "gameId must be a valid game id" },
      { status: 400 },
    );
  }
  const format = await getGameFormat(gameId);
  if (!format) {
    return NextResponse.json({ error: "game not found" }, { status: 400 });
  }

  const parsed = parseQuartersInput(raw, format.periodCount);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const outcome = await replaceQuarters(parsed.value, baseVersion);
    switch (outcome.status) {
      case "done":
        return NextResponse.json(outcome.value, {
          headers: { ETag: entityTag(outcome.value.version) },
        });
      case "conflict":
        return versionConflict({ ...outcome.current }, outcome.current.version);
      case "not-found":
        return NextResponse.json({ error: "game not found" }, { status: 400 });
    }
  } catch (cause) {
    if (isForeignKeyViolation(cause)) {
      return NextResponse.json({ error: "game not found" }, { status: 400 });
    }
    console.error("failed to replace quarters", cause);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
