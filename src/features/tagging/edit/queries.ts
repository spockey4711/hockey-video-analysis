/**
 * Database access for editing and deleting tags after capture (P0-8). Thin
 * wrappers over the `tags` table so the route handler stays readable and the
 * SQL lives in one place. Listing feeds the coach-facing tag list; update and
 * delete act on a single tag by id.
 */
import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";

import { clipWindowChanged } from "./recut";
import type { TagEditInput } from "./validation";

import type { Visibility } from "@/features/tag-players";
import { db } from "@/lib/db";
import { clips, tags } from "@/lib/db/schema";

/** A tag row shown in the coach-facing edit list, ordered by start time. */
export interface EditableTag {
  id: string;
  type: string;
  startS: number;
  endS: number | null;
  visibility: Visibility;
}

const returning = {
  id: tags.id,
  type: tags.type,
  startS: tags.startS,
  endS: tags.endS,
  visibility: tags.visibility,
} as const;

/** List a game's tags in start-time order (empty when none captured yet). */
export async function listGameTags(gameId: string): Promise<EditableTag[]> {
  return db
    .select(returning)
    .from(tags)
    .where(eq(tags.gameId, gameId))
    .orderBy(asc(tags.startS));
}

/**
 * Edit a tag's type and clip window in place. Returns the updated row, or
 * `null` when the id matches no tag (the route renders a 404). Visibility and
 * player links are edited through their own route (P0-7) and left untouched.
 *
 * When the edit moves the clip window ({@link clipWindowChanged}), the tag's
 * live clip goes back to `pending` so the worker cuts the new window. The clip
 * keeps its id, so the collections and comments attached to it stay; it leaves
 * the share views until the re-cut is `ready`. A `failed` clip is left for the
 * coach to retry.
 */
export async function updateTag(
  tagId: string,
  input: TagEditInput,
): Promise<EditableTag | null> {
  return db.transaction(async (tx) => {
    // Lock the row so a concurrent edit cannot slip between the read and the
    // write and leave the clip cut from a window the tag no longer has.
    const [before] = await tx
      .select({ type: tags.type, startS: tags.startS, endS: tags.endS })
      .from(tags)
      .where(eq(tags.id, tagId))
      .for("update");
    if (!before) return null;

    const rows = await tx
      .update(tags)
      .set({ type: input.type, startS: input.startS, endS: input.endS })
      .where(eq(tags.id, tagId))
      .returning(returning);

    if (clipWindowChanged(before, input)) {
      await tx
        .update(clips)
        .set({ status: "pending" })
        .where(
          and(
            eq(clips.tagId, tagId),
            inArray(clips.status, ["processing", "ready"]),
          ),
        );
    }
    return rows[0] ?? null;
  });
}

/**
 * Delete a tag by id. Returns `true` when a row was removed, `false` when the
 * id matched no tag (the route renders a 404). The `tags` foreign keys cascade,
 * so a tag's player links and any cut clips are removed with it.
 */
export async function deleteTag(tagId: string): Promise<boolean> {
  const rows = await db
    .delete(tags)
    .where(eq(tags.id, tagId))
    .returning({ id: tags.id });
  return rows.length > 0;
}
