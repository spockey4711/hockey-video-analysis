/**
 * `POST /api/tags` - persist a hotkey-captured tag (P0-6). Coach-only: the
 * client never touches the database directly (see the stack notes), so this
 * handler authenticates, validates the untrusted body, stamps the author from
 * the session, and inserts the tag.
 *
 * The Mac app calls it too, with its bearer token and a tag id it made itself
 * (ADR 0013): a retry of that create answers `200` with the tag as stored
 * instead of storing it twice, and an id taken by another game's tag is `409`.
 */
import { NextResponse } from "next/server";

import { entityTag } from "@/features/app-api/if-match";
import { insertTag } from "@/features/tagging/queries";
import { parseTagInput } from "@/features/tagging/validation";
import { getApiSession } from "@/lib/auth";

/** Postgres foreign-key-violation code, thrown when `gameId` has no game. */
const PG_FOREIGN_KEY_VIOLATION = "23503";

function isForeignKeyViolation(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === PG_FOREIGN_KEY_VIOLATION
  );
}

export async function POST(request: Request): Promise<Response> {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parseTagInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const outcome = await insertTag({
      ...parsed.value,
      authorId: session.coach.id,
    });
    if (outcome.status === "taken") {
      return NextResponse.json(
        { error: "id is taken by another tag" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { tag: outcome.tag },
      {
        status: outcome.status === "created" ? 201 : 200,
        headers: { ETag: entityTag(outcome.tag.version) },
      },
    );
  } catch (cause) {
    if (isForeignKeyViolation(cause)) {
      return NextResponse.json({ error: "game not found" }, { status: 400 });
    }
    console.error("failed to insert tag", cause);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
