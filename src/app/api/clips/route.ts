/**
 * `POST /api/clips` and `GET /api/clips?tagId=... | ?gameId=...` - enqueue a cut
 * job from a confirmed tag and read clip status (P0-9). Coach-only: clips belong
 * to the private team workspace and only a coach queues or inspects them, so the
 * client never touches the DB directly (see the stack notes). Enqueuing is
 * idempotent per tag; status is read back for the coach's cut-progress view.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import {
  enqueueClipForTag,
  listClipsByGame,
  listClipsByTag,
} from "@/features/clips/queries";
import { isUuid, parseClipEnqueueInput } from "@/features/clips/validation";

/** Postgres foreign-key-violation code, thrown when `tagId` has no tag. */
const PG_FOREIGN_KEY_VIOLATION = "23503";

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

  const params = new URL(request.url).searchParams;
  const tagId = params.get("tagId");
  const gameId = params.get("gameId");

  if ((tagId === null) === (gameId === null)) {
    return NextResponse.json(
      { error: "provide exactly one of tagId or gameId" },
      { status: 400 },
    );
  }

  if (tagId !== null) {
    if (!isUuid(tagId)) {
      return NextResponse.json(
        { error: "tagId must be a valid tag id" },
        { status: 400 },
      );
    }
    return NextResponse.json({ clips: await listClipsByTag(tagId) });
  }

  if (!isUuid(gameId)) {
    return NextResponse.json(
      { error: "gameId must be a valid game id" },
      { status: 400 },
    );
  }
  return NextResponse.json({ clips: await listClipsByGame(gameId) });
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

  const parsed = parseClipEnqueueInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const { clip, created } = await enqueueClipForTag(parsed.value.tagId);
    // 201 when this call queued the job, 200 when it already existed - the
    // enqueue is idempotent per tag, so a repeat is a success, not a conflict.
    return NextResponse.json({ clip }, { status: created ? 201 : 200 });
  } catch (cause) {
    if (isForeignKeyViolation(cause)) {
      return NextResponse.json({ error: "tag not found" }, { status: 400 });
    }
    console.error("failed to enqueue clip", cause);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
