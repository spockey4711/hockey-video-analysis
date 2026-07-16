/**
 * Database access for erasing a player (P1-6, PRD s8 - GDPR right to erasure).
 *
 * Deleting a player must take their personal data with them: their tag links and
 * their own `single` clips. The schema cascades most of this - `tag_players`
 * references `players` with `onDelete: cascade`, so every link this player is in
 * is removed when the row goes, and `clips` cascade from their `tags`. What a
 * plain player delete would leave behind is the player's *own* `single` tags
 * (and thus their cut clips): those are visibility-`single` moments captured for
 * this player, and once the player is gone they would linger, reachable by no
 * one yet still holding that player's footage. So this deletes them first.
 *
 * A `single` tag shared with another player is *not* this player's alone, so it
 * is kept (only this player's link cascades away) - erasing one player must not
 * strip a moment another player can still legitimately see. Team tags and their
 * clips are team data, never a single player's, and always stay.
 */
import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { clips, players, tagPlayers, tags } from "@/lib/db/schema";

/** What a deletion removed, for coach feedback and an audit trail. */
export interface PlayerDeletionSummary {
  /** The player's own `single` tags that were deleted (shared ones are kept). */
  readonly deletedTags: number;
  /** The cut clips removed with those tags. */
  readonly deletedClips: number;
}

/**
 * Erase a player and their personal data in one transaction, returning a summary
 * of what was removed, or `null` when the id matches no player (the action
 * reports a not-found without confirming which ids exist).
 *
 * Order matters: the player's sole-owned `single` tags are deleted first (which
 * cascades their clips and links), then the player row (which cascades the
 * remaining team-tag links). Everything is one transaction, so a failure leaves
 * neither a half-deleted player nor orphaned clips.
 */
export async function deletePlayerWithData(
  playerId: string,
): Promise<PlayerDeletionSummary | null> {
  return db.transaction(async (tx) => {
    const [player] = await tx
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    if (!player) return null;

    // The `single` tags this player is linked to; candidates for deletion.
    const linkedSingleTagIds = (
      await tx
        .selectDistinct({ tagId: tagPlayers.tagId })
        .from(tagPlayers)
        .innerJoin(tags, eq(tagPlayers.tagId, tags.id))
        .where(
          and(eq(tagPlayers.playerId, playerId), eq(tags.visibility, "single")),
        )
    ).map((r) => r.tagId);

    // Of those, the ones also linked to another player are shared, so kept.
    const sharedTagIds =
      linkedSingleTagIds.length === 0
        ? []
        : (
            await tx
              .selectDistinct({ tagId: tagPlayers.tagId })
              .from(tagPlayers)
              .where(
                and(
                  inArray(tagPlayers.tagId, linkedSingleTagIds),
                  ne(tagPlayers.playerId, playerId),
                ),
              )
          ).map((r) => r.tagId);

    const shared = new Set(sharedTagIds);
    const soleTagIds = linkedSingleTagIds.filter((id) => !shared.has(id));

    let deletedClips = 0;
    if (soleTagIds.length > 0) {
      // Count the clips that will cascade away, for the summary, before deleting
      // the tags that own them.
      const clipRows = await tx
        .select({ id: clips.id })
        .from(clips)
        .where(inArray(clips.tagId, soleTagIds));
      deletedClips = clipRows.length;

      // Deleting the tags cascades their clips and tag_players links.
      await tx.delete(tags).where(inArray(tags.id, soleTagIds));
    }

    // Removing the player cascades its remaining links (team tags, and any
    // shared `single` tags kept above).
    await tx.delete(players).where(eq(players.id, playerId));

    return { deletedTags: soleTagIds.length, deletedClips };
  });
}
