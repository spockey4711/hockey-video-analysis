/**
 * `GET /api/tags/[id]/players` and `PUT /api/tags/[id]/players` - read and set
 * the players a tag involves plus its visibility (P0-7). Coach-only: tags are
 * part of the private team workspace and only a coach edits them, so the client
 * never touches the DB directly (see the stack notes). `PUT` replaces the whole
 * player set and sets visibility after validating the untrusted body.
 *
 * The Mac app calls both with its bearer token; its `PUT` names the tag version
 * it started from in `If-Match` (ADR 0013), and a tag that has moved since is
 * left alone and answered `409` with its current state. The web sends no
 * header and saves without the check.
 */
import { NextResponse } from "next/server";

import { entityTag } from "@/features/app-api/if-match";
import { readBaseVersion, versionConflict } from "@/features/app-api/responses";
import { getTagPlayers, setTagPlayers } from "@/features/tag-players/queries";
import { parseTagPlayersInput } from "@/features/tag-players/validation";
import { getApiSession } from "@/lib/auth";

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
  request: Request,
  { params }: Context,
): Promise<Response> {
  if (!(await getApiSession(request))) {
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
  if (!(await getApiSession(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "id must be a valid tag id" },
      { status: 400 },
    );
  }

  const baseVersion = readBaseVersion(request);
  if (baseVersion instanceof Response) return baseVersion;

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
    const outcome = await setTagPlayers(id, parsed.value, baseVersion);
    switch (outcome.status) {
      case "done":
        return NextResponse.json(
          { tagPlayers: outcome.value },
          { headers: { ETag: entityTag(outcome.value.version) } },
        );
      case "conflict":
        return versionConflict(
          { tag: outcome.current },
          outcome.current.version,
        );
      case "not-found":
        return NextResponse.json({ error: "tag not found" }, { status: 404 });
    }
  } catch (cause) {
    if (isForeignKeyViolation(cause)) {
      return NextResponse.json({ error: "unknown player" }, { status: 400 });
    }
    console.error("failed to set tag players", cause);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
