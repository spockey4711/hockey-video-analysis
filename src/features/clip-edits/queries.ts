/**
 * Server-side reads and writes for a collection entry's clip edit (ADR 0011):
 * the `edit` document on a `collection_clips` row and its `edit_version` save
 * counter. Coach-only; the route handler authorizes before calling in.
 *
 * The edit is only ever read through `parseClipEdit`, so a stored document that
 * no longer parses reads as no edit rather than reaching a player half-broken.
 */
import "server-only";
import { and, eq, sql } from "drizzle-orm";

import { parseClipEdit, type ClipEdit, type TimeRange } from "./edit";

import { resolveClipEnd } from "@/features/clips/cut/window";
import type { ClipStatus } from "@/features/clips/status";
import { db } from "@/lib/db";
import { clips, collectionClips, tags } from "@/lib/db/schema";

/** One collection entry's edit, with what the editor needs to place it. */
export interface EntryEdit {
  /** The stored edit, or null for the plain clip. */
  readonly edit: ClipEdit | null;
  /** The save counter a later save must name. */
  readonly version: number;
  /** The clip's current tag window in game time: the footage its file holds. */
  readonly window: TimeRange;
  /** The game time at clip-file time 0, or null until the worker probed it. */
  readonly cutStartS: number | null;
  /** Whether the clip file is ready or being (re-)cut. */
  readonly clipStatus: ClipStatus;
}

/** Why a save did or did not land. */
export type SaveEditOutcome =
  | { readonly status: "saved"; readonly version: number }
  | { readonly status: "conflict"; readonly version: number }
  | { readonly status: "missing" };

/**
 * The edit of `clipId` in `collectionId`, or null when the clip is not in the
 * collection (or either does not exist).
 */
export async function getEntryEdit(
  collectionId: string,
  clipId: string,
): Promise<EntryEdit | null> {
  const [row] = await db
    .select({
      edit: collectionClips.edit,
      version: collectionClips.editVersion,
      cutStartS: clips.cutStartS,
      clipStatus: clips.status,
      tagType: tags.type,
      startS: tags.startS,
      endS: tags.endS,
    })
    .from(collectionClips)
    .innerJoin(clips, eq(clips.id, collectionClips.clipId))
    .innerJoin(tags, eq(tags.id, clips.tagId))
    .where(
      and(
        eq(collectionClips.collectionId, collectionId),
        eq(collectionClips.clipId, clipId),
      ),
    )
    .limit(1);
  if (!row) return null;

  const parsed = row.edit === null ? null : parseClipEdit(row.edit);
  if (parsed && !parsed.ok) {
    console.error(
      `stored clip edit of ${collectionId}/${clipId} does not parse: ${parsed.error}`,
    );
  }
  return {
    edit: parsed?.ok ? parsed.value : null,
    version: row.version,
    window: {
      startS: row.startS,
      endS: resolveClipEnd(row.startS, row.endS, row.tagType),
    },
    cutStartS: row.cutStartS,
    clipStatus: row.clipStatus,
  };
}

/**
 * Store `edit` (null clears it) for `clipId` in `collectionId`, but only if the
 * entry is still at `expectedVersion`, and move it to the next version. A save
 * started from an older version is a conflict that reports the current one, so
 * a second editor tab can never silently overwrite the first.
 */
export async function saveEntryEdit(
  collectionId: string,
  clipId: string,
  edit: ClipEdit | null,
  expectedVersion: number,
): Promise<SaveEditOutcome> {
  const entry = and(
    eq(collectionClips.collectionId, collectionId),
    eq(collectionClips.clipId, clipId),
  );
  const [saved] = await db
    .update(collectionClips)
    .set({ edit, editVersion: sql`${collectionClips.editVersion} + 1` })
    .where(and(entry, eq(collectionClips.editVersion, expectedVersion)))
    .returning({ version: collectionClips.editVersion });
  if (saved) return { status: "saved", version: saved.version };

  const [current] = await db
    .select({ version: collectionClips.editVersion })
    .from(collectionClips)
    .where(entry)
    .limit(1);
  return current
    ? { status: "conflict", version: current.version }
    : { status: "missing" };
}
