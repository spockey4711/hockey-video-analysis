/**
 * `GET` and `PUT /api/collections/[id]/clips/[clipId]/edit` - read and save a
 * collection entry's clip edit (ADR 0011): its trim, slow motion, zoom and
 * markers, applied on this collection's link only. Coach-only: the clip editor
 * is a coach tool, and the login-free link gets the edit as a display-ready
 * playback plan through the share queries instead.
 *
 * `GET` returns the edit (null = plain clip), its save version, the clip's
 * current window and where its file starts. `PUT` takes `{ version, edit }`:
 * the untrusted edit is validated and must fit the clip's window, and a save
 * started from an older version than the stored one is refused with 409 and
 * the current version, so two editor tabs never overwrite each other silently.
 * An entry that does not exist is a 404.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import {
  checkEditWindow,
  MAX_EDIT_JSON_LENGTH,
  parseSaveEditInput,
} from "@/features/clip-edits";
import { getEntryEdit, saveEntryEdit } from "@/features/clip-edits/queries";
import { isUuid } from "@/features/clips/validation";

type Context = { params: Promise<{ id: string; clipId: string }> };

/** Room for the `{ version, edit }` wrapper around a maximal edit. */
const MAX_BODY_LENGTH = MAX_EDIT_JSON_LENGTH + 1024;

/** The two ids from the path, or the 400 answering a malformed one. */
async function entryIds(
  params: Context["params"],
): Promise<{ collectionId: string; clipId: string } | Response> {
  const { id, clipId } = await params;
  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "id must be a valid collection id" },
      { status: 400 },
    );
  }
  if (!isUuid(clipId)) {
    return NextResponse.json(
      { error: "clipId must be a valid clip id" },
      { status: 400 },
    );
  }
  return { collectionId: id, clipId };
}

const notFound = () =>
  NextResponse.json({ error: "clip not in collection" }, { status: 404 });

export async function GET(
  _request: Request,
  { params }: Context,
): Promise<Response> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ids = await entryIds(params);
  if (ids instanceof Response) return ids;

  const entry = await getEntryEdit(ids.collectionId, ids.clipId);
  if (!entry) return notFound();
  return NextResponse.json(entry);
}

export async function PUT(
  request: Request,
  { params }: Context,
): Promise<Response> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ids = await entryIds(params);
  if (ids instanceof Response) return ids;

  const text = await request.text();
  if (text.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: "edit is too large" }, { status: 413 });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parseSaveEditInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { edit, version } = parsed.value;

  const entry = await getEntryEdit(ids.collectionId, ids.clipId);
  if (!entry) return notFound();
  const outside = edit && checkEditWindow(edit, entry.window);
  if (outside) {
    return NextResponse.json({ error: outside }, { status: 400 });
  }

  const outcome = await saveEntryEdit(
    ids.collectionId,
    ids.clipId,
    edit,
    version,
  );
  switch (outcome.status) {
    case "saved":
      return NextResponse.json({ edit, version: outcome.version });
    case "conflict":
      return NextResponse.json(
        {
          error: "the edit was changed elsewhere; reload it",
          version: outcome.version,
        },
        { status: 409 },
      );
    case "missing":
      return notFound();
  }
}
