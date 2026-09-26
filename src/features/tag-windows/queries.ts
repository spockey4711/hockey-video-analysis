/**
 * Database access for the team's tag windows (`tag_type_windows`). Only the
 * windows that differ from their type's default are stored, so a reset is a
 * delete and a type follows its default wherever the team never set one.
 * Changing a window never touches `tags`: a tag stores its own start and end.
 */
import "server-only";
import { notInArray } from "drizzle-orm";

import { changedTagWindows } from "./form";
import { readTagWindows } from "./read";

import { db } from "@/lib/db";
import { tagTypeWindows } from "@/lib/db/schema";
import type { TagWindows } from "@/lib/tag-types";

/** The windows the team captures new tags with. */
export async function getTagWindows(): Promise<TagWindows> {
  return readTagWindows(db);
}

/**
 * Store the team's windows, one per configured type, in one transaction: a
 * window that differs from its default is upserted, and every other row -
 * a window put back to its default, or one of a retired type - is removed.
 */
export async function setTagWindows(windows: TagWindows): Promise<void> {
  const changed = changedTagWindows(windows);
  await db.transaction(async (tx) => {
    const keep = changed.map(({ type }) => type);
    await tx
      .delete(tagTypeWindows)
      .where(
        keep.length > 0 ? notInArray(tagTypeWindows.type, keep) : undefined,
      );
    for (const { type, window } of changed) {
      await tx
        .insert(tagTypeWindows)
        .values({ type, preS: window.preS, postS: window.postS })
        .onConflictDoUpdate({
          target: tagTypeWindows.type,
          set: { preS: window.preS, postS: window.postS },
        });
    }
  });
}

/** Put every type back on its default window. */
export async function resetTagWindows(): Promise<void> {
  await db.delete(tagTypeWindows);
}
