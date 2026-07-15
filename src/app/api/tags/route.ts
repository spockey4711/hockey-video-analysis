/**
 * `POST /api/tags` - persist a hotkey-captured tag (P0-6). Coach-only: the
 * client never touches the database directly (see the stack notes), so this
 * handler authenticates, validates the untrusted body, stamps the author from
 * the session, and inserts the tag.
 */
import { NextResponse } from "next/server";

import { insertTag } from "@/features/tagging/queries";
import { parseTagInput } from "@/features/tagging/validation";
import { getCurrentCoach } from "@/lib/auth";

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

  const parsed = parseTagInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const tag = await insertTag({ ...parsed.value, authorId: coach.id });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (cause) {
    if (isForeignKeyViolation(cause)) {
      return NextResponse.json({ error: "game not found" }, { status: 400 });
    }
    console.error("failed to insert tag", cause);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
