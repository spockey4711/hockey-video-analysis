/**
 * Server-side reads and writes for the coach-only collection curation surfaces
 * (P2-13). A collection is a named, hand-picked set of ready clips shared by its
 * own `collections.share_token`. These functions back the list and detail pages:
 * listing collections, reading one for editing, listing the ready clips a coach
 * can pick from, and the create/save/delete/rotate mutations.
 *
 * Membership is only ever ready clips: `saveCollectionClips` intersects the
 * requested ids with the ready-clip set before inserting, so a stale or forged
 * id can never become a member and the share link can never point at a clip that
 * is not cut yet.
 */
import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { generateShareToken } from "@/features/access/rotation/token";
import { db } from "@/lib/db";
import {
  clips,
  collectionClips,
  collections,
  games,
  tags,
} from "@/lib/db/schema";

/** Postgres unique-violation code, raised if a fresh share token collides (astronomically rare). */
const PG_UNIQUE_VIOLATION = "23505";

// A 256-bit random token colliding with an existing one is astronomically
// unlikely, but `share_token` is `unique`, so retry a few times rather than
// surface a spurious failure on the vanishing chance it happens (mirrors the
// player share-token rotation).
const MAX_TOKEN_ATTEMPTS = 3;

/** One collection as shown on the coach list, with the count of clips it holds. */
export interface CollectionListItem {
  readonly id: string;
  readonly name: string;
  /** The unguessable secret in the collection's share link; rotating it revokes the link. */
  readonly shareToken: string;
  readonly clipCount: number;
}

/** A collection loaded for editing: its fields plus the ids of its member clips. */
export interface CollectionForEdit {
  readonly id: string;
  readonly name: string;
  readonly shareToken: string;
  /** Ids of the clips currently in the collection (checked in the editor). */
  readonly clipIds: readonly string[];
}

/** One ready clip a coach can add to a collection, with the parts of its label. */
export interface CurationClipRow {
  readonly id: string;
  readonly tagType: string;
  readonly startS: number;
  readonly gameTitle: string;
  readonly gameOpponent: string | null;
  /** `single` clips are player-specific; surfaced so the coach curates knowingly. */
  readonly isSingle: boolean;
}

/** Every collection, newest first, with its clip count (empty when none). */
export async function listCollections(): Promise<CollectionListItem[]> {
  return db
    .select({
      id: collections.id,
      name: collections.name,
      shareToken: collections.shareToken,
      clipCount: count(collectionClips.clipId),
    })
    .from(collections)
    .leftJoin(collectionClips, eq(collectionClips.collectionId, collections.id))
    .groupBy(collections.id)
    .orderBy(desc(collections.createdAt));
}

/**
 * Load one collection for editing, or `null` when the id matches none (the page
 * turns `null` into a 404). Returns the member clip ids so the editor can mark
 * the checked clips.
 */
export async function getCollectionForEdit(
  collectionId: string,
): Promise<CollectionForEdit | null> {
  const [collection] = await db
    .select({
      id: collections.id,
      name: collections.name,
      shareToken: collections.shareToken,
    })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);
  if (!collection) return null;

  const members = await db
    .select({ clipId: collectionClips.clipId })
    .from(collectionClips)
    .where(eq(collectionClips.collectionId, collectionId));

  return { ...collection, clipIds: members.map((row) => row.clipId) };
}

/**
 * List every ready clip a coach can curate into a collection, newest game first
 * then by game-time within a game (the same order the share views play in).
 * Includes both `team` and `single` clips: a collection is an explicit, curated
 * set, so the coach may knowingly include a player-specific clip; `isSingle`
 * flags those in the checklist.
 */
export async function listReadyClipsForCuration(): Promise<CurationClipRow[]> {
  const rows = await db
    .select({
      id: clips.id,
      tagType: tags.type,
      startS: tags.startS,
      gameTitle: games.title,
      gameOpponent: games.opponent,
      visibility: tags.visibility,
    })
    .from(clips)
    .innerJoin(tags, eq(clips.tagId, tags.id))
    .innerJoin(games, eq(tags.gameId, games.id))
    .where(eq(clips.status, "ready"))
    .orderBy(desc(games.playedOn), asc(tags.startS));

  return rows.map((row) => ({
    id: row.id,
    tagType: row.tagType,
    startS: row.startS,
    gameTitle: row.gameTitle,
    gameOpponent: row.gameOpponent,
    isSingle: row.visibility === "single",
  }));
}

/** The outcome of creating a collection: its id (to redirect to) and fresh token. */
export interface CreatedCollection {
  readonly id: string;
  readonly shareToken: string;
}

/**
 * Create an empty collection with a fresh, unguessable share token and return
 * its id. Retries on the rare unique-token collision so the caller never sees a
 * spurious failure.
 */
export async function createCollection(input: {
  name: string;
  createdBy: string;
}): Promise<CreatedCollection> {
  for (let attempt = 1; attempt <= MAX_TOKEN_ATTEMPTS; attempt += 1) {
    const shareToken = generateShareToken();
    try {
      const [row] = await db
        .insert(collections)
        .values({
          name: input.name,
          shareToken,
          createdBy: input.createdBy,
        })
        .returning({ id: collections.id, shareToken: collections.shareToken });
      // `returning` always yields the inserted row on a successful insert.
      if (row) return row;
      throw new Error("createCollection: insert returned no row");
    } catch (cause) {
      if (isUniqueViolation(cause) && attempt < MAX_TOKEN_ATTEMPTS) continue;
      throw cause;
    }
  }
  // Unreachable: the loop either returns or throws on its last attempt.
  throw new Error("createCollection: exhausted token attempts");
}

/**
 * Save a collection's name and replace its membership with the given clip ids,
 * or return `false` when the id matches no collection. The requested ids are
 * intersected with the ready-clip set inside the transaction, so only real,
 * ready clips ever become members. Runs in one transaction so a half-applied
 * membership can never be observed.
 */
export async function saveCollection(
  collectionId: string,
  input: { name: string; clipIds: readonly string[] },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(collections)
      .set({ name: input.name })
      .where(eq(collections.id, collectionId))
      .returning({ id: collections.id });
    if (updated.length === 0) return false;

    await tx
      .delete(collectionClips)
      .where(eq(collectionClips.collectionId, collectionId));

    if (input.clipIds.length > 0) {
      const ready = await tx
        .select({ id: clips.id })
        .from(clips)
        .where(
          and(eq(clips.status, "ready"), inArray(clips.id, [...input.clipIds])),
        );
      if (ready.length > 0) {
        await tx
          .insert(collectionClips)
          .values(ready.map((clip) => ({ collectionId, clipId: clip.id })));
      }
    }
    return true;
  });
}

/**
 * Delete a collection (and its membership rows, via cascade), or return `false`
 * when the id matches none. The underlying clips are untouched.
 */
export async function deleteCollection(collectionId: string): Promise<boolean> {
  const deleted = await db
    .delete(collections)
    .where(eq(collections.id, collectionId))
    .returning({ id: collections.id });
  return deleted.length > 0;
}

/** The outcome of a rotation: the freshly issued token that now revokes the old link. */
export interface RotatedCollectionToken {
  readonly shareToken: string;
}

/**
 * Replace a collection's share token with a fresh one and return it, or `null`
 * when the id matches none. Overwriting the token is what revokes the old link
 * (the previous value stops resolving). Retries on the rare collision.
 */
export async function rotateCollectionShareToken(
  collectionId: string,
): Promise<RotatedCollectionToken | null> {
  for (let attempt = 1; attempt <= MAX_TOKEN_ATTEMPTS; attempt += 1) {
    const shareToken = generateShareToken();
    try {
      const rows = await db
        .update(collections)
        .set({ shareToken })
        .where(eq(collections.id, collectionId))
        .returning({ shareToken: collections.shareToken });
      return rows[0] ?? null;
    } catch (cause) {
      if (isUniqueViolation(cause) && attempt < MAX_TOKEN_ATTEMPTS) continue;
      throw cause;
    }
  }
  // Unreachable: the loop either returns or throws on its last attempt.
  return null;
}

function isUniqueViolation(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}
