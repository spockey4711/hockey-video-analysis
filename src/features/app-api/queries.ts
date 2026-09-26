/**
 * The Mac app's pull (ADR 0013, Mac plan S3): the library lists every game,
 * collection and scene with its revision, and the Mac fetches a full snapshot
 * of each one whose revision moved. The database triggers bump the revisions,
 * so every write path counts, and a deleted aggregate simply drops out.
 *
 * Every payload is built field by field from explicit columns, never from a
 * whole row, so no share token (a player's, a collection's or the team's) can
 * reach the Mac: share links are fetched on demand and never stored there.
 * Each read runs in one read-only repeatable-read transaction, so a snapshot
 * and the revision it carries always belong together.
 */
import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { Visibility } from "@/features/tag-players/validation";
import { db } from "@/lib/db";
import {
  clips,
  collections,
  gameSources,
  games,
  players,
  quarters,
  tacticsScenes,
  tagPlayers,
  tags,
  teamSettings,
} from "@/lib/db/schema";

const SNAPSHOT = {
  isolationLevel: "repeatable read",
  accessMode: "read only",
} as const;

/** A game in the library. An empty title is a game still under review. */
export interface LibraryGame {
  readonly id: string;
  readonly title: string;
  readonly opponent: string | null;
  readonly playedOn: string | null;
  readonly revision: number;
}

/** A collection or tactics scene in the library. */
export interface LibraryItem {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
}

/** Everything the Mac syncs, each with the revision it is at. */
export interface Library {
  readonly games: readonly LibraryGame[];
  readonly collections: readonly LibraryItem[];
  readonly scenes: readonly LibraryItem[];
  readonly rosterRevision: number;
}

/** A game with its own fields, versions and revision. */
export interface GameFields {
  readonly id: string;
  readonly title: string;
  readonly opponent: string | null;
  readonly playedOn: string | null;
  /** The game's own format; null plays the team default. */
  readonly periodCount: number | null;
  readonly periodLengthS: number | null;
  readonly version: number;
  readonly revision: number;
  readonly quartersVersion: number;
}

/** One chapter file of a game, in play order (ADR 0002). */
export interface GameChapter {
  readonly id: string;
  readonly orderIndex: number;
  /** The file's path relative to the media root, never a local Mac path. */
  readonly filePath: string;
  readonly durationS: number;
  readonly frameRate: number | null;
}

/** A quarter of a game; the set's version is the game's `quartersVersion`. */
export interface GameQuarter {
  readonly index: number;
  readonly startS: number;
  readonly endS: number | null;
}

/** The newest clip cut from a tag, as far as the Mac needs to know it. */
export interface TagClip {
  readonly id: string;
  readonly status: "pending" | "processing" | "ready" | "failed";
  readonly cutStartS: number | null;
}

/** A tag with its players, visibility and clip. */
export interface GameTag {
  readonly id: string;
  readonly type: string;
  readonly startS: number;
  readonly endS: number | null;
  readonly visibility: Visibility;
  readonly source: "manual" | "suggestion";
  readonly authorId: string | null;
  readonly playerIds: readonly string[];
  readonly version: number;
  readonly createdAt: Date;
  readonly clip: TagClip | null;
}

/** A game's full snapshot at one revision. */
export interface GameSnapshot {
  readonly game: GameFields;
  readonly chapters: readonly GameChapter[];
  readonly quarters: readonly GameQuarter[];
  readonly tags: readonly GameTag[];
}

/** A player of the roster, without the share token. */
export interface RosterEntry {
  readonly id: string;
  readonly name: string;
  readonly jerseyNumber: number | null;
  readonly version: number;
}

/** The whole roster at one revision. */
export interface Roster {
  readonly rosterRevision: number;
  readonly players: readonly RosterEntry[];
}

type Executor = Pick<typeof db, "select">;

async function readRosterRevision(executor: Executor): Promise<number> {
  const [settings] = await executor
    .select({ rosterRevision: teamSettings.rosterRevision })
    .from(teamSettings)
    .limit(1);
  return settings?.rosterRevision ?? 1;
}

/**
 * The library: every game the coach sees (a game the importer still hides is
 * left out, as on the web), every collection and scene, and the roster
 * revision.
 */
export async function getLibrary(): Promise<Library> {
  return db.transaction(async (tx) => {
    const gameRows = await tx
      .select({
        id: games.id,
        title: games.title,
        opponent: games.opponent,
        playedOn: games.playedOn,
        revision: games.revision,
      })
      .from(games)
      .where(eq(games.awaitingProxies, false))
      .orderBy(desc(games.playedOn), desc(games.createdAt), asc(games.id));
    const collectionRows = await tx
      .select({
        id: collections.id,
        name: collections.name,
        revision: collections.revision,
      })
      .from(collections)
      .orderBy(desc(collections.createdAt), asc(collections.id));
    const sceneRows = await tx
      .select({
        id: tacticsScenes.id,
        name: tacticsScenes.name,
        revision: tacticsScenes.revision,
      })
      .from(tacticsScenes)
      .orderBy(desc(tacticsScenes.createdAt), asc(tacticsScenes.id));
    return {
      games: gameRows.map((row) => ({
        id: row.id,
        title: row.title,
        opponent: row.opponent,
        playedOn: row.playedOn,
        revision: row.revision,
      })),
      collections: collectionRows.map(toLibraryItem),
      scenes: sceneRows.map(toLibraryItem),
      rosterRevision: await readRosterRevision(tx),
    };
  }, SNAPSHOT);
}

function toLibraryItem(row: LibraryItem): LibraryItem {
  return { id: row.id, name: row.name, revision: row.revision };
}

/**
 * A game's snapshot: its fields, chapters, quarters and tags with players,
 * visibility and clip status. `null` when no such game exists or the importer
 * still hides it.
 */
export async function getGameSnapshot(
  gameId: string,
): Promise<GameSnapshot | null> {
  return db.transaction(async (tx) => {
    const [game] = await tx
      .select({
        id: games.id,
        title: games.title,
        opponent: games.opponent,
        playedOn: games.playedOn,
        periodCount: games.periodCount,
        periodLengthS: games.periodLengthS,
        version: games.version,
        revision: games.revision,
        quartersVersion: games.quartersVersion,
      })
      .from(games)
      .where(and(eq(games.id, gameId), eq(games.awaitingProxies, false)))
      .limit(1);
    if (!game) return null;

    const chapters = await tx
      .select({
        id: gameSources.id,
        orderIndex: gameSources.orderIndex,
        filePath: gameSources.filePath,
        durationS: gameSources.durationS,
        frameRate: gameSources.frameRate,
      })
      .from(gameSources)
      .where(eq(gameSources.gameId, gameId))
      .orderBy(asc(gameSources.orderIndex));
    const quarterRows = await tx
      .select({
        index: quarters.index,
        startS: quarters.startS,
        endS: quarters.endS,
      })
      .from(quarters)
      .where(eq(quarters.gameId, gameId))
      .orderBy(asc(quarters.index));
    const tagRows = await tx
      .select({
        id: tags.id,
        type: tags.type,
        startS: tags.startS,
        endS: tags.endS,
        visibility: tags.visibility,
        source: tags.source,
        authorId: tags.authorId,
        version: tags.version,
        createdAt: tags.createdAt,
      })
      .from(tags)
      .where(eq(tags.gameId, gameId))
      .orderBy(asc(tags.startS), asc(tags.id));

    const tagIds = tagRows.map((tag) => tag.id);
    const links =
      tagIds.length === 0
        ? []
        : await tx
            .select({ tagId: tagPlayers.tagId, playerId: tagPlayers.playerId })
            .from(tagPlayers)
            .where(inArray(tagPlayers.tagId, tagIds))
            .orderBy(asc(tagPlayers.playerId));
    const clipRows =
      tagIds.length === 0
        ? []
        : await tx
            .select({
              id: clips.id,
              tagId: clips.tagId,
              status: clips.status,
              cutStartS: clips.cutStartS,
            })
            .from(clips)
            .where(inArray(clips.tagId, tagIds))
            .orderBy(desc(clips.createdAt), asc(clips.id));

    const playersByTag = new Map<string, string[]>();
    for (const link of links) {
      const list = playersByTag.get(link.tagId) ?? [];
      list.push(link.playerId);
      playersByTag.set(link.tagId, list);
    }
    // Newest first, so the first clip seen for a tag is its current one.
    const clipByTag = new Map<string, TagClip>();
    for (const clip of clipRows) {
      if (clipByTag.has(clip.tagId)) continue;
      clipByTag.set(clip.tagId, {
        id: clip.id,
        status: clip.status,
        cutStartS: clip.cutStartS,
      });
    }

    return {
      game: {
        id: game.id,
        title: game.title,
        opponent: game.opponent,
        playedOn: game.playedOn,
        periodCount: game.periodCount,
        periodLengthS: game.periodLengthS,
        version: game.version,
        revision: game.revision,
        quartersVersion: game.quartersVersion,
      },
      chapters: chapters.map((chapter) => ({
        id: chapter.id,
        orderIndex: chapter.orderIndex,
        filePath: chapter.filePath,
        durationS: chapter.durationS,
        frameRate: chapter.frameRate,
      })),
      quarters: quarterRows.map((quarter) => ({
        index: quarter.index,
        startS: quarter.startS,
        endS: quarter.endS,
      })),
      tags: tagRows.map((tag) => ({
        id: tag.id,
        type: tag.type,
        startS: tag.startS,
        endS: tag.endS,
        visibility: tag.visibility,
        source: tag.source,
        authorId: tag.authorId,
        playerIds: playersByTag.get(tag.id) ?? [],
        version: tag.version,
        createdAt: tag.createdAt,
        clip: clipByTag.get(tag.id) ?? null,
      })),
    };
  }, SNAPSHOT);
}

/**
 * The roster with its revision, in the order a coach scans a team sheet
 * (numbered players first, then by name). Never a share token.
 */
export async function getRoster(): Promise<Roster> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: players.id,
        name: players.name,
        jerseyNumber: players.jerseyNumber,
        version: players.version,
      })
      .from(players)
      .orderBy(asc(players.jerseyNumber), asc(players.name), asc(players.id));
    return {
      rosterRevision: await readRosterRevision(tx),
      players: rows.map((row) => ({
        id: row.id,
        name: row.name,
        jerseyNumber: row.jerseyNumber,
        version: row.version,
      })),
    };
  }, SNAPSHOT);
}
