/**
 * Database access for linking players to a tag and setting its visibility
 * (P0-7). Thin wrappers over the `tags` and `tag_players` tables so the route
 * handler stays readable and the SQL lives in one place. A tag's player set and
 * visibility are always read and written together as one unit.
 */
import "server-only";
import { eq } from "drizzle-orm";

import type { TagPlayersInput, Visibility } from "./validation";

import { db } from "@/lib/db";
import { tagPlayers, tags } from "@/lib/db/schema";

/** A tag's current player links and visibility (empty `playerIds` is valid). */
export interface TagPlayers {
  readonly visibility: Visibility;
  readonly playerIds: readonly string[];
}

/**
 * Read a tag's visibility and linked player ids, or `null` when no such tag
 * exists (the caller renders a 404). The player ids are unordered.
 */
export async function getTagPlayers(tagId: string): Promise<TagPlayers | null> {
  const tagRows = await db
    .select({ visibility: tags.visibility })
    .from(tags)
    .where(eq(tags.id, tagId))
    .limit(1);

  const tag = tagRows[0];
  if (!tag) return null;

  const links = await db
    .select({ playerId: tagPlayers.playerId })
    .from(tagPlayers)
    .where(eq(tagPlayers.tagId, tagId));

  return {
    visibility: tag.visibility,
    playerIds: links.map((l) => l.playerId),
  };
}

/**
 * Replace a tag's whole player set and set its visibility in one transaction:
 * update the visibility, then delete the existing links and insert the new set.
 * Setting a tag's players is a full overwrite (a coach edits the involved
 * players as a unit), which avoids partial-update states and keeps the
 * `(tag_id, player_id)` primary key trivially satisfied.
 *
 * Returns `null` when the tag id matches no tag, so the update is a no-op and no
 * links are touched. Inserting an unknown `playerId` raises a foreign-key
 * violation the route turns into a 400.
 */
export async function setTagPlayers(
  tagId: string,
  input: TagPlayersInput,
): Promise<TagPlayers | null> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(tags)
      .set({ visibility: input.visibility })
      .where(eq(tags.id, tagId))
      .returning({ id: tags.id });

    if (updated.length === 0) return null;

    await tx.delete(tagPlayers).where(eq(tagPlayers.tagId, tagId));

    if (input.playerIds.length > 0) {
      await tx
        .insert(tagPlayers)
        .values(input.playerIds.map((playerId) => ({ tagId, playerId })));
    }

    return { visibility: input.visibility, playerIds: input.playerIds };
  });
}
