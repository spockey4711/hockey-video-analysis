/**
 * Database access for clip cut jobs (P0-9). Thin wrappers over the `clips`
 * table so the route handler stays readable and the SQL lives in one place.
 *
 * Enqueuing is the DB-queue handoff (ADR 0003): inserting a `pending` row is the
 * job. The hockey-video-pipeline worker polls for `pending` clips, cuts them,
 * and writes back `processing -> ready | failed` plus `outputPath` on the same
 * rows; the app never calls the worker in-process.
 */
import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";

import type { ClipStatus } from "./status";

import { db } from "@/lib/db";
import { clips, tags } from "@/lib/db/schema";

/** A persisted clip cut job. `outputPath` is null until the worker reports `ready`. */
export interface ClipRow {
  id: string;
  tagId: string;
  status: ClipStatus;
  outputPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A clip joined with the tag it was cut from, for a game's status board. */
export interface ClipWithTag extends ClipRow {
  tagType: string;
  tagStartS: number;
  tagEndS: number | null;
}

/** Result of an enqueue: the clip, and whether this call created it. */
export interface EnqueueResult {
  clip: ClipRow;
  created: boolean;
}

const clipColumns = {
  id: clips.id,
  tagId: clips.tagId,
  status: clips.status,
  outputPath: clips.outputPath,
  createdAt: clips.createdAt,
  updatedAt: clips.updatedAt,
} as const;

/**
 * Enqueue a cut job for a confirmed tag, idempotently. If the tag already has a
 * live clip (`pending`/`processing`/`ready`), that clip is returned untouched so
 * a double click never queues a duplicate cut; only when every prior attempt
 * `failed` does a fresh `pending` row get inserted. Runs in a transaction to
 * narrow the check-then-insert race; the frozen schema (P0-1) carries no unique
 * constraint to enforce it at the database. Inserting for a missing `tagId`
 * raises a foreign-key violation the route turns into a 400.
 */
export async function enqueueClipForTag(tagId: string): Promise<EnqueueResult> {
  return db.transaction(async (tx) => {
    // A live clip is any non-`failed` one (`isActiveClipStatus`); `failed` is
    // terminal and retryable, so it never blocks a fresh enqueue.
    const [live] = await tx
      .select(clipColumns)
      .from(clips)
      .where(and(eq(clips.tagId, tagId), ne(clips.status, "failed")))
      .orderBy(desc(clips.createdAt))
      .limit(1);

    if (live) {
      return { clip: live, created: false };
    }

    const inserted = await tx
      .insert(clips)
      .values({ tagId, status: "pending" })
      .returning(clipColumns);
    return { clip: inserted[0], created: true };
  });
}

/** List a tag's clips, newest first (empty when none are queued yet). */
export async function listClipsByTag(tagId: string): Promise<ClipRow[]> {
  return db
    .select(clipColumns)
    .from(clips)
    .where(eq(clips.tagId, tagId))
    .orderBy(desc(clips.createdAt));
}

/**
 * List every clip cut from a game's tags, newest first, joined with the tag it
 * came from - the coach's per-game status board (which tags have ready clips,
 * which are still cutting, which failed).
 */
export async function listClipsByGame(gameId: string): Promise<ClipWithTag[]> {
  return db
    .select({
      ...clipColumns,
      tagType: tags.type,
      tagStartS: tags.startS,
      tagEndS: tags.endS,
    })
    .from(clips)
    .innerJoin(tags, eq(clips.tagId, tags.id))
    .where(eq(tags.gameId, gameId))
    .orderBy(desc(clips.createdAt));
}
