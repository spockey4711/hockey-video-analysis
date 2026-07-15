/**
 * `GET /api/clips/[id]/comments` and `POST /api/clips/[id]/comments` - read and
 * add comments on a clip (P1-2, PRD 5.6). Two audiences: a signed-in coach, or a
 * login-free share-link viewer who passes a player `?shareToken=`. A share token
 * is authorized against the clip (`canShareTokenReachClip`) so a link never
 * comments on clips it may not see; an unknown or non-reaching token is a 401,
 * which also avoids leaking whether the clip exists to a share viewer.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import {
  addCommentToClip,
  canShareTokenReachClip,
  clipExists,
  listCommentsForClip,
  parseCommentInput,
} from "@/features/clips/comments";
import { isUuid } from "@/features/clips/validation";

/** Postgres foreign-key-violation code, thrown when `id` has no clip. */
const PG_FOREIGN_KEY_VIOLATION = "23503";

function isForeignKeyViolation(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === PG_FOREIGN_KEY_VIOLATION
  );
}

type Context = { params: Promise<{ id: string }> };

/**
 * Resolve who is asking. `"coach"` when a coach session is present; `"share"`
 * when a valid `shareToken` reaches this clip; `null` when neither authorizes.
 * The clip id is trusted to be a valid uuid by the time this runs.
 */
async function authorize(
  clipId: string,
  request: Request,
): Promise<"coach" | "share" | null> {
  const coach = await getCurrentCoach();
  if (coach) return "coach";

  const shareToken = new URL(request.url).searchParams.get("shareToken");
  if (shareToken && (await canShareTokenReachClip(shareToken, clipId))) {
    return "share";
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: Context,
): Promise<Response> {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "id must be a valid clip id" },
      { status: 400 },
    );
  }

  const actor = await authorize(id, request);
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // A share token is only authorized for clips it can reach, so its access
  // already implies the clip exists; only the coach path needs a 404 check.
  if (actor === "coach" && !(await clipExists(id))) {
    return NextResponse.json({ error: "clip not found" }, { status: 404 });
  }

  return NextResponse.json({ comments: await listCommentsForClip(id) });
}

export async function POST(
  request: Request,
  { params }: Context,
): Promise<Response> {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "id must be a valid clip id" },
      { status: 400 },
    );
  }

  const actor = await authorize(id, request);
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parseCommentInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const comment = await addCommentToClip(id, parsed.value);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (cause) {
    if (isForeignKeyViolation(cause)) {
      return NextResponse.json({ error: "clip not found" }, { status: 404 });
    }
    console.error("failed to add comment", cause);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
