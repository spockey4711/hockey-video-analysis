/**
 * Server-side reads for the login-free collection share link (P2-13).
 *
 * A collection's secret link is keyed by `collections.share_token` (like the
 * per-player link's `players.share_token`, and unlike the env-backed team link).
 * The link shows exactly the clips a coach put in the collection and nothing
 * else: {@link listReadyClipsForCollection} joins strictly through the
 * `collection_clips` membership for this one collection, so a recipient can only
 * ever reach the curated set and never another collection's clips (CLAUDE.md:
 * login-free surfaces must not leak).
 */
import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  clips,
  collectionClips,
  collections,
  games,
  tags,
} from "@/lib/db/schema";

/** The collection a share token resolves to; the id drives the clip query, the name the heading. */
export interface ShareCollection {
  readonly id: string;
  readonly name: string;
}

/** One ready clip in a collection, joined with the tag and game it came from. */
export interface CollectionClipRow {
  readonly id: string;
  readonly tagType: string;
  readonly startS: number;
  /** Present once the worker reports the clip `ready`; the query filters nulls out. */
  readonly outputPath: string;
  readonly gameTitle: string;
  readonly gameOpponent: string | null;
}

/**
 * Resolve a share token to its collection, or `undefined` when no collection
 * carries it (an unknown or empty token). The route turns `undefined` into a
 * 404, so a leaked-but-wrong link never confirms which tokens exist. An empty
 * candidate is rejected without touching the database.
 */
export async function getCollectionByShareToken(
  token: string,
): Promise<ShareCollection | undefined> {
  if (token.length === 0) return undefined;

  const [collection] = await db
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(eq(collections.shareToken, token))
    .limit(1);
  return collection;
}

/**
 * List every ready clip in a collection, newest game first then by game-time
 * within a game so the playlist reads as a chronological session (empty when
 * none). Scoped to `collectionId` through `collection_clips`, so no clip outside
 * the curated set can appear.
 */
export async function listReadyClipsForCollection(
  collectionId: string,
): Promise<CollectionClipRow[]> {
  const rows = await db
    .select({
      id: clips.id,
      tagType: tags.type,
      startS: tags.startS,
      outputPath: clips.outputPath,
      gameTitle: games.title,
      gameOpponent: games.opponent,
    })
    .from(collectionClips)
    .innerJoin(clips, eq(collectionClips.clipId, clips.id))
    .innerJoin(tags, eq(clips.tagId, tags.id))
    .innerJoin(games, eq(tags.gameId, games.id))
    .where(
      and(
        eq(collectionClips.collectionId, collectionId),
        eq(clips.status, "ready"),
      ),
    )
    .orderBy(desc(games.playedOn), asc(tags.startS));

  // `output_path` is nullable in the schema; a `ready` clip always has one, but
  // narrow defensively so a malformed row can never reach the player as a null src.
  return rows.flatMap((row) =>
    row.outputPath === null ? [] : [{ ...row, outputPath: row.outputPath }],
  );
}
