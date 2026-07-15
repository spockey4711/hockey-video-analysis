/**
 * `PATCH /api/tags/[id]` and `DELETE /api/tags/[id]` - edit and delete a tag
 * after capture (P0-8, PRD 5.2). Coach-only: tags are part of the private team
 * workspace and only a coach edits them, so the client never touches the DB
 * directly (see the stack notes). `PATCH` replaces the tag's editable fields
 * (type and clip window) as a unit after validating the untrusted body;
 * visibility and players have their own route (P0-7). Both map a missing tag to
 * 404.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import { deleteTag, updateTag } from "@/features/tagging/edit/queries";
import { parseTagEditInput } from "@/features/tagging/edit/validation";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function PATCH(
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

  const parsed = parseTagEditInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const tag = await updateTag(id, parsed.value);
  if (!tag) {
    return NextResponse.json({ error: "tag not found" }, { status: 404 });
  }
  return NextResponse.json({ tag });
}

export async function DELETE(
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

  const deleted = await deleteTag(id);
  if (!deleted) {
    return NextResponse.json({ error: "tag not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
