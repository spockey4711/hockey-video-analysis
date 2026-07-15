/**
 * Database access for editing and deleting tags after capture (P0-8). Thin
 * wrappers over the `tags` table so the route handler stays readable and the
 * SQL lives in one place. Listing feeds the coach-facing tag list; update and
 * delete act on a single tag by id.
 */
import "server-only";
import { asc, eq } from "drizzle-orm";

import type { TagEditInput } from "./validation";

import type { Visibility } from "@/features/tag-players";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";

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
 */
export async function updateTag(
  tagId: string,
  input: TagEditInput,
): Promise<EditableTag | null> {
  const rows = await db
    .update(tags)
    .set({ type: input.type, startS: input.startS, endS: input.endS })
    .where(eq(tags.id, tagId))
    .returning(returning);
  return rows[0] ?? null;
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
