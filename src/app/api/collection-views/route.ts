/**
 * `POST /api/collection-views` - anonymous view counting on the collection
 * share link (ADR 0009). Login-free: the report carries the collection's share
 * token, and an event is only stored for a ready clip in that collection. The
 * players send reports fire-and-forget, so the answer is deliberately terse:
 * `204` whether the event was stored, dropped as a duplicate or over the daily
 * bound, or of an unknown type; `404` when the token and clip do not belong
 * together (no distinction, so nothing confirms which tokens exist).
 *
 * A signed-in coach previewing the link is not counted.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import {
  clientIp,
  parseViewEvent,
  recordViewEvent,
} from "@/features/share/views";

/** A report is a few dozen bytes; anything much larger is not one. */
const MAX_BODY_BYTES = 1_024;

function noContent(): Response {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "body too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "body too large" }, { status: 413 });
    }
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parseViewEvent(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  if (parsed.value === null) return noContent();

  try {
    if (await getCurrentCoach()) return noContent();

    const outcome = await recordViewEvent(parsed.value, {
      ip: clientIp(request.headers),
      userAgent: request.headers.get("user-agent") ?? "",
    });
    if (outcome === "not-found") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return noContent();
  } catch (cause) {
    console.error("failed to record view event", cause);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
