/**
 * `GET /api/tags/[id]/players` and `PUT /api/tags/[id]/players` - read and set
 * the players a tag involves plus its visibility (P0-7). Coach-only: tags are
 * part of the private team workspace and only a coach edits them, so the client
 * never touches the DB directly (see the stack notes). `PUT` replaces the whole
 * player set and sets visibility after validating the untrusted body.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import { getTagPlayers, setTagPlayers } from "@/features/tag-players/queries";
import { parseTagPlayersInput } from "@/features/tag-players/validation";

/** Postgres foreign-key-violation code, thrown when a `playerId` has no player. */
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

type Context = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  { params }: Context,
): Promise<Response> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "id must be a valid tag id" },
      { status: 400 },
    );
  }

  const tagPlayers = await getTagPlayers(id);
  if (!tagPlayers) {
    return NextResponse.json({ error: "tag not found" }, { status: 404 });
  }

  return NextResponse.json({ tagPlayers });
}

export async function PUT(
  request: Request,
  { params }: Context,
): Promise<Response> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "id must be a valid tag id" },
      { status: 400 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parseTagPlayersInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const tagPlayers = await setTagPlayers(id, parsed.value);
    if (!tagPlayers) {
      return NextResponse.json({ error: "tag not found" }, { status: 404 });
    }
    return NextResponse.json({ tagPlayers });
  } catch (cause) {
    if (isForeignKeyViolation(cause)) {
      return NextResponse.json({ error: "unknown player" }, { status: 400 });
    }
    console.error("failed to set tag players", cause);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
