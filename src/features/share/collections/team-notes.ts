/**
 * Server-side reads and writes for a collection's team notes: the coach's intro
 * for the whole collection (`collections.team_note`) and a short text for each
 * clip in it (`collection_clips.team_note`). Unlike the presenter notes (see
 * `./presenter-notes`), these are public to anyone with the collection link:
 * the share queries select them for the playlist and the title cards in
 * presentation mode. The two kinds live in separate columns and are saved by
 * separate forms and actions, so a private note never lands in a public one.
 *
 * A clip's team note lives on its membership row, so taking the clip out of the
 * collection, or deleting the clip or the collection, removes it with it.
 */
import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";

import type { CollectionNotesInput } from "./validation";

import { db } from "@/lib/db";
import { collectionClips, collections } from "@/lib/db/schema";

/** A collection's stored team notes, as the coach editor reads them. */
export interface TeamNotes {
  /** The intro for the whole collection; `null` when none. */
  readonly collection: string | null;
  /** Each clip's team note by clip id; clips without one are left out. */
  readonly clips: Readonly<Record<string, string>>;
}

/** A collection's stored team notes (empty when it has none). */
export async function getTeamNotes(collectionId: string): Promise<TeamNotes> {
  const [collection] = await db
    .select({ note: collections.teamNote })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  const rows = await db
    .select({ clipId: collectionClips.clipId, note: collectionClips.teamNote })
    .from(collectionClips)
    .where(
      and(
        eq(collectionClips.collectionId, collectionId),
        isNotNull(collectionClips.teamNote),
      ),
    );

  const clips: Record<string, string> = {};
  for (const row of rows) {
    if (row.note) clips[row.clipId] = row.note;
  }
  return { collection: collection?.note ?? null, clips };
}

/**
 * Store a collection's team notes, or return `false` when the id matches no
 * collection. Only clips that are members of the collection get a note; a
 * submitted id outside it is ignored. Runs in one transaction so the notes are
 * saved together or not at all.
 */
export async function saveTeamNotes(
  collectionId: string,
  input: CollectionNotesInput,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(collections)
      .set({ teamNote: input.collection })
      .where(eq(collections.id, collectionId))
      .returning({ id: collections.id });
    if (updated.length === 0) return false;

    const members = await tx
      .select({
        clipId: collectionClips.clipId,
        note: collectionClips.teamNote,
      })
      .from(collectionClips)
      .where(eq(collectionClips.collectionId, collectionId));

    for (const member of members) {
      if (!input.clips.has(member.clipId)) continue;
      const note = input.clips.get(member.clipId) ?? null;
      if (note === member.note) continue;
      await tx
        .update(collectionClips)
        .set({ teamNote: note })
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
