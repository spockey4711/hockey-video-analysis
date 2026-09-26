/**
 * Database access for linking players to a tag and setting its visibility
 * (P0-7). Thin wrappers over the `tags` and `tag_players` tables so the route
 * handler stays readable and the SQL lives in one place. A tag's player set and
 * visibility are always read and written together as one unit.
 */
import "server-only";
import { and, asc, eq, notInArray } from "drizzle-orm";

import type { TagPlayersInput, Visibility } from "./validation";

import { readTagState, type TagWriteOutcome } from "@/features/tagging/state";
import { db } from "@/lib/db";
import { players, tagPlayers, tags } from "@/lib/db/schema";

/** A tag's current player links and visibility (empty `playerIds` is valid). */
export interface TagPlayers {
  readonly visibility: Visibility;
  readonly playerIds: readonly string[];
}

/** A selectable player for the tag-players picker (P0-7). */
export interface RosterPlayer {
  readonly id: string;
  readonly name: string;
  /** Jersey number, or `null` when the player has none. */
  readonly jerseyNumber: number | null;
}

/**
 * List every player, for the picker that links players to a tag. Players are a
 * flat, team-wide roster (not scoped to a game), so the picker offers all of
 * them. Ordered by jersey number (numbered players first, ascending) then name,
 * so the list reads the way a coach scans a team sheet.
 */
export async function listRoster(): Promise<RosterPlayer[]> {
  return db
    .select({
      id: players.id,
      name: players.name,
      jerseyNumber: players.jerseyNumber,
    })
    .from(players)
    .orderBy(asc(players.jerseyNumber), asc(players.name));
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

/** A tag's player links and visibility after a save, with the tag's version. */
export interface SavedTagPlayers extends TagPlayers {
  readonly version: number;
}

/**
 * Replace a tag's whole player set and set its visibility in one transaction.
 * Setting a tag's players is a full overwrite (a coach edits the involved
 * players as a unit), written as the difference to the stored set: a save that
 * changes nothing leaves the tag's version alone (ADR 0013), so it never makes
 * another device's edit look stale.
 *
 * `baseVersion` is the tag version the save started from (`If-Match`): when the
 * tag has moved past it, nothing is written and the current state comes back
 * as a conflict. `null` saves without the check, as the web does. Inserting an
 * unknown `playerId` raises a foreign-key violation the route turns into a 400.
 */
export async function setTagPlayers(
  tagId: string,
  input: TagPlayersInput,
  baseVersion: number | null = null,
): Promise<TagWriteOutcome<SavedTagPlayers>> {
  return db.transaction(async (tx) => {
    // Lock the tag so a concurrent save cannot interleave with this one.
    const [tag] = await tx
      .select({ visibility: tags.visibility, version: tags.version })
      .from(tags)
      .where(eq(tags.id, tagId))
      .for("update");
    if (!tag) return { status: "not-found" };
    if (baseVersion !== null && tag.version !== baseVersion) {
      const current = await readTagState(tagId, tx);
      return current
        ? { status: "conflict", current }
        : { status: "not-found" };
    }

    if (tag.visibility !== input.visibility) {
      await tx
        .update(tags)
        .set({ visibility: input.visibility })
        .where(eq(tags.id, tagId));
    }
    const kept = [...input.playerIds];
    await tx
      .delete(tagPlayers)
      .where(
        kept.length > 0
          ? and(
              eq(tagPlayers.tagId, tagId),
              notInArray(tagPlayers.playerId, kept),
            )
          : eq(tagPlayers.tagId, tagId),
      );
    if (kept.length > 0) {
      await tx
        .insert(tagPlayers)
        .values(kept.map((playerId) => ({ tagId, playerId })))
        .onConflictDoNothing();
    }

    // The triggers bumped the version for every link that moved; read it back.
    const [saved] = await tx
      .select({ version: tags.version })
      .from(tags)
      .where(eq(tags.id, tagId));
    return {
      status: "done",
      value: {
        visibility: input.visibility,
        playerIds: input.playerIds,
        version: saved?.version ?? tag.version,
      },
    };
  });
}
