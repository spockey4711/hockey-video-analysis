/**
 * `PATCH /api/tags/[id]` and `DELETE /api/tags/[id]` - edit and delete a tag
 * after capture (P0-8, PRD 5.2). Coach-only: tags are part of the private team
 * workspace and only a coach edits them, so the client never touches the DB
 * directly (see the stack notes). `PATCH` replaces the tag's editable fields
 * (type and clip window) as a unit after validating the untrusted body;
 * visibility and players have their own route (P0-7). Both map a missing tag to
 * 404.
 *
 * The Mac app calls both with its bearer token and the tag version it started
 * from in `If-Match` (ADR 0013): a tag that has moved since is left alone and
 * answered `409` with its current state. The web sends no header and writes
 * without the check.
 */
import { NextResponse } from "next/server";

import { entityTag } from "@/features/app-api/if-match";
import { readBaseVersion, versionConflict } from "@/features/app-api/responses";
import { deleteTag, updateTag } from "@/features/tagging/edit/queries";
import { parseTagEditInput } from "@/features/tagging/edit/validation";
import { getApiSession } from "@/lib/auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function PATCH(
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

  const parsed = parseTagEditInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const outcome = await updateTag(id, parsed.value, baseVersion);
  switch (outcome.status) {
    case "done":
      return NextResponse.json(
        { tag: outcome.value },
        { headers: { ETag: entityTag(outcome.value.version) } },
      );
    case "conflict":
      return versionConflict({ tag: outcome.current }, outcome.current.version);
    case "not-found":
      return NextResponse.json({ error: "tag not found" }, { status: 404 });
  }
}

export async function DELETE(
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

  const outcome = await deleteTag(id, baseVersion);
  switch (outcome.status) {
    case "done":
      return new NextResponse(null, { status: 204 });
    case "conflict":
      return versionConflict({ tag: outcome.current }, outcome.current.version);
    case "not-found":
      return NextResponse.json({ error: "tag not found" }, { status: 404 });
  }
}
