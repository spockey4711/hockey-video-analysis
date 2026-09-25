/**
 * `GET` and `POST /api/collections` - the collections a clip can go into, for
 * the watch page's "In Sammlung bearbeiten" (ADR 0011). `GET` lists every
 * collection, newest first, with its clip count; the share token stays out of
 * it, as nothing here needs the link. `POST` takes `{ name, clipId? }` and
 * creates a collection, starting with that clip when one is given; a clip
 * that is not ready is refused with 422 and nothing is created.
 *
 * Coach-only, like the rest of the collection authoring.
 */
import { NextResponse } from "next/server";

import { getCurrentCoach } from "@/features/access";
import {
  createCollection,
  createCollectionWithClip,
  listCollections,
} from "@/features/share/collections/queries";
import { parseCreateCollectionInput } from "@/features/share/collections/validation";

export async function GET(): Promise<Response> {
  if (!(await getCurrentCoach())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const collections = await listCollections();
  return NextResponse.json({
    collections: collections.map(({ id, name, clipCount }) => ({
      id,
      name,
      clipCount,
    })),
  });
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
  const parsed = parseCreateCollectionInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { name, clipId } = parsed.value;

  const created =
    clipId === null
      ? await createCollection({ name, createdBy: coach.id })
      : await createCollectionWithClip({ name, createdBy: coach.id, clipId });
  if (!created) {
    return NextResponse.json(
      { error: "the clip is not ready" },
      { status: 422 },
    );
  }
  return NextResponse.json({ id: created.id }, { status: 201 });
}
