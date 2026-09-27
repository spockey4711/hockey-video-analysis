/**
 * Server-side reads and writes for the coach-only collection curation surfaces
 * (P2-13). A collection is a named, hand-picked set of ready clips shared by its
 * own `collections.share_token`. These functions back the list and detail pages:
 * listing collections, reading one for editing, listing the ready clips a coach
 * can pick from, and the create/save/delete/rotate mutations and the link's
 * end date. The clip editor
 * adds single clips through {@link addClipToCollection}.
 *
 * A clip only joins a collection while it is ready: `saveCollection` intersects
 * the requested ids with the ready-clip set before inserting, so a stale or
 * forged id can never become a member. A member that is re-cut later stays a
 * member; the share link only plays it once it is ready again.
 */
import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { clipsToRemove } from "./curation-items";

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
  /** When the share link stops working, `null` when it has no end date. */
  readonly shareExpiresAt: Date | null;
  readonly clipCount: number;
}

/** A collection loaded for editing: its fields plus the ids of its member clips. */
export interface CollectionForEdit {
  readonly id: string;
  readonly name: string;
  readonly shareToken: string;
  /** When the share link stops working, `null` when it has no end date. */
  readonly shareExpiresAt: Date | null;
  /** Ids of the clips currently in the collection (checked in the editor). */
  readonly clipIds: readonly string[];
}

/** One ready clip a coach can add to a collection, with the parts of its label. */
export interface CurationClipRow {
  readonly id: string;
  readonly tagType: string;
  readonly startS: number;
  /** The game's date, for placing scene entries between the clips. */
  readonly playedOn: string | null;
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
      shareExpiresAt: collections.shareExpiresAt,
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
      shareExpiresAt: collections.shareExpiresAt,
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
      playedOn: games.playedOn,
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
    playedOn: row.playedOn,
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
 * Create a collection holding one clip, for starting a collection straight
 * from a clip (the watch page's "In Sammlung bearbeiten"). Returns `null` and
 * creates nothing when the clip is not ready (or does not exist), so a stale
 * or forged id never leaves an empty collection behind. Runs in one
 * transaction, retried whole on the rare unique-token collision.
 */
export async function createCollectionWithClip(input: {
  name: string;
  createdBy: string;
  clipId: string;
}): Promise<CreatedCollection | null> {
  for (let attempt = 1; attempt <= MAX_TOKEN_ATTEMPTS; attempt += 1) {
    const shareToken = generateShareToken();
    try {
      return await db.transaction(async (tx) => {
        if (!(await isClipReady(tx, input.clipId))) return null;
        const [row] = await tx
          .insert(collections)
          .values({
            name: input.name,
            shareToken,
            createdBy: input.createdBy,
          })
          .returning({
            id: collections.id,
            shareToken: collections.shareToken,
          });
        // `returning` always yields the inserted row on a successful insert.
        if (!row) throw new Error("createCollectionWithClip: no row");
        await tx
          .insert(collectionClips)
          .values({ collectionId: row.id, clipId: input.clipId });
        return row;
      });
    } catch (cause) {
      if (isUniqueViolation(cause) && attempt < MAX_TOKEN_ATTEMPTS) continue;
      throw cause;
    }
  }
  // Unreachable: the loop either returns or throws on its last attempt.
  throw new Error("createCollectionWithClip: exhausted token attempts");
}

/**
 * Why adding one clip to a collection did or did not change it: `added`, or
 * `duplicate` when the clip is already in it (one clip is at most one entry
 * of a collection, ADR 0011), `clip-not-ready` when the clip is not a
 * ready clip, or `missing` when the collection does not exist.
 */
export type AddClipOutcome =
  "added" | "duplicate" | "clip-not-ready" | "missing";

/**
 * Add one ready clip to a collection, as the clip editor's picker does. The
 * collection's other entries, their notes and edits are left alone, and a
 * clip already in the collection is refused rather than added twice. Runs in
 * one transaction so the checks and the insert see the same state.
 */
export async function addClipToCollection(
  collectionId: string,
  clipId: string,
): Promise<AddClipOutcome> {
  return db.transaction(async (tx) => {
    const [collection] = await tx
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);
    if (!collection) return "missing";
    if (!(await isClipReady(tx, clipId))) return "clip-not-ready";

    const inserted = await tx
      .insert(collectionClips)
      .values({ collectionId, clipId })
      .onConflictDoNothing()
      .returning({ clipId: collectionClips.clipId });
    return inserted.length > 0 ? "added" : "duplicate";
  });
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function isClipReady(tx: Transaction, clipId: string): Promise<boolean> {
  const [clip] = await tx
    .select({ id: clips.id })
    .from(clips)
    .where(and(eq(clips.id, clipId), eq(clips.status, "ready")))
    .limit(1);
  return clip !== undefined;
}

/**
 * Save a collection's name and its membership from the curation checklist, or
 * return `false` when the id matches no collection. `listedClipIds` are the
 * clips the checklist showed and `clipIds` the ones ticked among them: a listed
 * clip left unticked leaves the collection, and a ticked one joins it if it is
 * still ready (intersected inside the transaction, so a stale or forged id can
 * never become a member). A member the checklist did not list - a clip being
 * re-cut or one whose cut failed - is left alone, so a save never drops it
 * unseen. Clips that stay keep their membership row, and with it their notes; a
 * clip taken out loses its row and notes. Runs in one transaction so a
 * half-applied membership can never be observed.
 */
export async function saveCollection(
  collectionId: string,
  input: {
    name: string;
    clipIds: readonly string[];
    listedClipIds: readonly string[];
  },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(collections)
      .set({ name: input.name })
      .where(eq(collections.id, collectionId))
      .returning({ id: collections.id });
    if (updated.length === 0) return false;

    const ready =
      input.clipIds.length === 0
        ? []
        : await tx
            .select({ id: clips.id })
            .from(clips)
            .where(
              and(
                eq(clips.status, "ready"),
                inArray(clips.id, [...input.clipIds]),
              ),
            );
    const readyIds = ready.map((clip) => clip.id);

    const removed = clipsToRemove(input.listedClipIds, input.clipIds);
    if (removed.length > 0) {
      await tx
        .delete(collectionClips)
        .where(
          and(
            eq(collectionClips.collectionId, collectionId),
            inArray(collectionClips.clipId, removed),
          ),
        );
    }
    if (readyIds.length > 0) {
      await tx
        .insert(collectionClips)
        .values(readyIds.map((clipId) => ({ collectionId, clipId })))
        .onConflictDoNothing();
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

/**
 * Set when a collection's share link stops working, or clear it (`null`) so
 * the link works until it is reset. Returns `false` when the id matches none.
 * The token is untouched: the same link works again if the date moves out.
 */
export async function setCollectionShareExpiry(
  collectionId: string,
  expiresAt: Date | null,
): Promise<boolean> {
  const rows = await db
    .update(collections)
    .set({ shareExpiresAt: expiresAt })
    .where(eq(collections.id, collectionId))
    .returning({ id: collections.id });
  return rows.length > 0;
}

function isUniqueViolation(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}
