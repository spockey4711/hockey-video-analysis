/**
 * Server-side reads and writes for a collection's presenter notes: the coach's
 * private talking points for the whole collection (`collections.presenter_note`)
 * and for each clip in it (`collection_clips.presenter_note`). A clip's note
 * lives on its membership row, so taking the clip out of the collection, or
 * deleting the clip or the collection, removes the note with it.
 *
 * The notes are for a signed-in coach only. The coach detail page reads them
 * behind the coach guard; the collection share page reads them only after it
 * has resolved a coach session, and the login-free share queries never select
 * them.
 */
import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";

import type { CollectionNotesInput } from "./validation";

import type { PresenterNotes } from "@/features/share/presentation/presenter-notes";
import { db } from "@/lib/db";
import { collectionClips, collections } from "@/lib/db/schema";

/** A collection's stored presenter notes (empty when it has none). */
export async function getPresenterNotes(
  collectionId: string,
): Promise<PresenterNotes> {
  const [collection] = await db
    .select({ note: collections.presenterNote })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  const rows = await db
    .select({
      clipId: collectionClips.clipId,
      note: collectionClips.presenterNote,
    })
    .from(collectionClips)
    .where(
      and(
        eq(collectionClips.collectionId, collectionId),
        isNotNull(collectionClips.presenterNote),
      ),
    );

  const clips: Record<string, string> = {};
  for (const row of rows) {
    if (row.note) clips[row.clipId] = row.note;
  }
  return { collection: collection?.note ?? null, clips };
}

/**
 * Store a collection's presenter notes, or return `false` when the id matches
 * no collection. Only clips that are members of the collection get a note; a
 * submitted id outside it is ignored. Runs in one transaction so the notes are
 * saved together or not at all.
 */
export async function savePresenterNotes(
  collectionId: string,
  input: CollectionNotesInput,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(collections)
      .set({ presenterNote: input.collection })
      .where(eq(collections.id, collectionId))
      .returning({ id: collections.id });
    if (updated.length === 0) return false;

    const members = await tx
      .select({
        clipId: collectionClips.clipId,
        note: collectionClips.presenterNote,
      })
      .from(collectionClips)
      .where(eq(collectionClips.collectionId, collectionId));

    for (const member of members) {
      if (!input.clips.has(member.clipId)) continue;
      const note = input.clips.get(member.clipId) ?? null;
      if (note === member.note) continue;
      await tx
        .update(collectionClips)
        .set({ presenterNote: note })
        .where(
          and(
            eq(collectionClips.collectionId, collectionId),
            eq(collectionClips.clipId, member.clipId),
          ),
        );
    }
    return true;
  });
}
