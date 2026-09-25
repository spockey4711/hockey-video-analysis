/**
 * `GET` and `POST /api/collections/[id]/clips` - the clip editor's picker
 * (ADR 0011). `GET` lists every ready clip a coach can add, with the choices
 * of its game, tag type and player filters, each clip marked when it is
 * already in the collection. `POST` takes `{ clipId }` and adds that one clip,
 * leaving the other entries, their notes and edits alone.
 *
 * Coach-only, like the rest of the collection authoring. A clip already in
 * the collection is refused with 409 (one clip is at most one entry of a
 * collection), a clip that is not ready with 422, and an unknown collection
 * is a 404.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import { getPickerData } from "@/features/clip-editor/picker/queries";
import { isUuid } from "@/features/clips/validation";
import { addClipToCollection } from "@/features/share/collections/queries";
import { parseAddClipInput } from "@/features/share/collections/validation";

type Context = { params: Promise<{ id: string }> };

const unauthorized = () =>
  NextResponse.json({ error: "unauthorized" }, { status: 401 });

const badId = () =>
  NextResponse.json(
    { error: "id must be a valid collection id" },
    { status: 400 },
  );

const notFound = () =>
  NextResponse.json({ error: "collection not found" }, { status: 404 });

export async function GET(
  _request: Request,
  { params }: Context,
): Promise<Response> {
  if (!(await getCurrentCoach())) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return badId();

  const picker = await getPickerData(id);
  if (!picker) return notFound();
  return NextResponse.json(picker);
}

export async function POST(
  request: Request,
  { params }: Context,
): Promise<Response> {
  if (!(await getCurrentCoach())) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return badId();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = parseAddClipInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { clipId } = parsed.value;

  switch (await addClipToCollection(id, clipId)) {
    case "added":
      return NextResponse.json({ clipId }, { status: 201 });
    case "duplicate":
      return NextResponse.json(
        { error: "the clip is already in the collection" },
        { status: 409 },
      );
    case "clip-not-ready":
      return NextResponse.json(
        { error: "the clip is not ready" },
        { status: 422 },
      );
    case "missing":
      return notFound();
  }
}
