/**
 * Server-side reads and writes for tactics scenes placed in a collection (ADR
 * 0013). A scene entry plays on the collection link and in presentation mode
 * between the clips; where it plays is its placement after a clip (see
 * `entries.ts`). The coach adds, moves, times and removes entries from the
 * collection page; the share link reads them to play.
 *
 * Every scene read back passes `parseScene`, so an entry whose scene no longer
 * parses is left out rather than drawn half-broken. The share link receives
 * only what drawing the scene needs (see {@link toSharedScene}).
 */
import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";

import {
  mergeEntries,
  moveScene,
  placementsOf,
  type ClipOrderKey,
  type MoveDirection,
  type OrderedClip,
  type PlacedScene,
} from "./entries";

import { parseScene, type TacticsScene } from "@/features/tactics/scene";
import { db } from "@/lib/db";
import {
  clips,
  collectionClips,
  collectionScenes,
  collections,
  games,
  tacticsScenes,
  tags,
} from "@/lib/db/schema";

/** One scene entry of a collection, placed and ready to draw. */
export interface SceneEntryRow extends PlacedScene {
  /** The tactics scene the entry shows; coach-side only, never on the link. */
  readonly sceneId: string;
  /** The scene's name, the entry's title. */
  readonly name: string;
  readonly scene: TacticsScene;
  /** How long a still scene stays up, in seconds. */
  readonly holdS: number;
}

type Executor = Pick<typeof db, "select">;

/**
 * Every scene entry of a collection with its placement: the play-order key of
 * the clip it follows, `null` before the first clip or once that clip is
 * deleted. Entries whose scene no longer parses are left out.
 */
export async function listSceneEntries(
  collectionId: string,
  executor: Executor = db,
): Promise<SceneEntryRow[]> {
  const rows = await executor
    .select({
      id: collectionScenes.id,
      sceneId: collectionScenes.sceneId,
      position: collectionScenes.position,
      holdS: collectionScenes.holdS,
      name: tacticsScenes.name,
      scene: tacticsScenes.scene,
      afterClipId: collectionScenes.afterClipId,
      afterPlayedOn: games.playedOn,
      afterStartS: tags.startS,
    })
    .from(collectionScenes)
    .innerJoin(tacticsScenes, eq(collectionScenes.sceneId, tacticsScenes.id))
    .leftJoin(clips, eq(collectionScenes.afterClipId, clips.id))
    .leftJoin(tags, eq(clips.tagId, tags.id))
    .leftJoin(games, eq(tags.gameId, games.id))
    .where(eq(collectionScenes.collectionId, collectionId));

  return rows.flatMap((row) => {
    const scene = parseScene(row.scene);
    if (!scene) return [];
    const after: ClipOrderKey | null =
      row.afterClipId === null || row.afterStartS === null
        ? null
        : { playedOn: row.afterPlayedOn, startS: row.afterStartS };
    return [
      {
        id: row.id,
        sceneId: row.sceneId,
        name: row.name,
        scene,
        holdS: row.holdS,
        position: row.position,
        after,
      },
    ];
  });
}

/**
 * The collection's ready member clips in play order, with their keys: the
 * clips the link plays and the coach's running order shows, so a scene is
 * moved and added among exactly those.
 */
async function listOrderedClips(
  executor: Executor,
  collectionId: string,
): Promise<OrderedClip[]> {
  const rows = await executor
    .select({ id: clips.id, playedOn: games.playedOn, startS: tags.startS })
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
  return rows.map(({ id, playedOn, startS }) => ({
    id,
    key: { playedOn, startS },
  }));
}

/**
 * Why adding a scene did or did not change the collection: `added`, or
 * `duplicate` when the scene is already in it, `scene-missing` when there is
 * no such scene, or `missing` when the collection does not exist.
 */
export type AddSceneOutcome =
  "added" | "duplicate" | "scene-missing" | "missing";

/**
 * Add a scene to the end of a collection's play order. Runs in one
 * transaction, so the placement is worked out from the order it lands in.
 */
export async function addSceneToCollection(
  collectionId: string,
  sceneId: string,
): Promise<AddSceneOutcome> {
  return db.transaction(async (tx) => {
    const [collection] = await tx
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);
    if (!collection) return "missing";
    const [scene] = await tx
      .select({ id: tacticsScenes.id })
      .from(tacticsScenes)
      .where(eq(tacticsScenes.id, sceneId))
      .limit(1);
    if (!scene) return "scene-missing";

    const entries = mergeEntries(
      await listOrderedClips(tx, collectionId),
      await listSceneEntries(collectionId, tx),
    );
    const placement = placementsOf<OrderedClip, { id: string }>([
      ...entries,
      { kind: "scene", scene: { id: sceneId } },
    ]).at(-1);
    const inserted = await tx
      .insert(collectionScenes)
      .values({
        collectionId,
        sceneId,
        afterClipId: placement?.afterClipId ?? null,
        position: placement?.position ?? 0,
      })
      .onConflictDoNothing()
      .returning({ id: collectionScenes.id });
    return inserted.length > 0 ? "added" : "duplicate";
  });
}

/**
 * Move a scene entry one place up or down the play order, past a clip or
 * another scene. Returns `false` when there is no such entry in the
 * collection or it is already first or last. Every scene's placement is
 * rewritten from the new order in one transaction.
 */
export async function moveSceneEntry(
  collectionId: string,
  entryId: string,
  direction: MoveDirection,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const entries = mergeEntries(
      await listOrderedClips(tx, collectionId),
      await listSceneEntries(collectionId, tx),
    );
    const moved = moveScene(entries, entryId, direction);
    if (!moved) return false;
    for (const placement of placementsOf(moved)) {
      await tx
        .update(collectionScenes)
        .set({
          afterClipId: placement.afterClipId,
          position: placement.position,
        })
        .where(
          and(
            eq(collectionScenes.id, placement.id),
            eq(collectionScenes.collectionId, collectionId),
          ),
        );
    }
    return true;
  });
}

/** Set how long a still scene stays up; `false` when there is no such entry. */
export async function setSceneHold(
  collectionId: string,
  entryId: string,
  holdS: number,
): Promise<boolean> {
  const rows = await db
    .update(collectionScenes)
    .set({ holdS })
    .where(
      and(
        eq(collectionScenes.id, entryId),
        eq(collectionScenes.collectionId, collectionId),
      ),
    )
    .returning({ id: collectionScenes.id });
  return rows.length > 0;
}

/** Take a scene out of a collection; `false` when there is no such entry. */
export async function removeSceneEntry(
  collectionId: string,
  entryId: string,
): Promise<boolean> {
  const rows = await db
    .delete(collectionScenes)
    .where(
      and(
        eq(collectionScenes.id, entryId),
        eq(collectionScenes.collectionId, collectionId),
      ),
    )
    .returning({ id: collectionScenes.id });
  return rows.length > 0;
}
