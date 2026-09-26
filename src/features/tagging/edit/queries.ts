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
import { readTagState, type TagWriteOutcome } from "@/features/tagging/state";
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

/** A tag as an edit leaves it, with its row version (ADR 0013). */
export interface VersionedTag extends EditableTag {
  version: number;
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
 * Edit a tag's type and clip window in place. Visibility and player links are
 * edited through their own route (P0-7) and left untouched. `baseVersion` is
 * the version the edit started from (`If-Match`, ADR 0013): when the tag has
 * moved past it, nothing is written and the current state comes back as a
 * conflict. `null` edits without the check, as the web does.
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
  baseVersion: number | null = null,
): Promise<TagWriteOutcome<VersionedTag>> {
  return db.transaction(async (tx) => {
    // Lock the row so a concurrent edit cannot slip between the read and the
    // write and leave the clip cut from a window the tag no longer has.
    const [before] = await tx
      .select({
        type: tags.type,
        startS: tags.startS,
        endS: tags.endS,
        version: tags.version,
      })
      .from(tags)
      .where(eq(tags.id, tagId))
      .for("update");
    if (!before) return { status: "not-found" };
    if (baseVersion !== null && before.version !== baseVersion) {
      const current = await readTagState(tagId, tx);
      return current
        ? { status: "conflict", current }
        : { status: "not-found" };
    }

    const [row] = await tx
      .update(tags)
      .set({ type: input.type, startS: input.startS, endS: input.endS })
      .where(eq(tags.id, tagId))
      .returning({ ...returning, version: tags.version });

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
    return row ? { status: "done", value: row } : { status: "not-found" };
  });
}

/**
 * Delete a tag by id. The `tags` foreign keys cascade, so a tag's player links
 * and any cut clips are removed with it. With a `baseVersion` (`If-Match`), a
 * tag that has moved past it is kept and comes back as a conflict, so a delete
 * never discards an edit the deleting side has not seen.
 */
export async function deleteTag(
  tagId: string,
  baseVersion: number | null = null,
): Promise<TagWriteOutcome<null>> {
  const condition =
    baseVersion === null
      ? eq(tags.id, tagId)
      : and(eq(tags.id, tagId), eq(tags.version, baseVersion));
  const rows = await db
    .delete(tags)
    .where(condition)
    .returning({ id: tags.id });
  if (rows.length > 0) return { status: "done", value: null };
  const current = baseVersion === null ? null : await readTagState(tagId);
  return current ? { status: "conflict", current } : { status: "not-found" };
}
