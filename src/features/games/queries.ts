/**
 * Database access for the games flow. Thin wrappers over the `games` and
 * `game_sources` tables so the server action and pages stay readable and the SQL
 * lives in one place.
 */
import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import type { ValidatedGameSource } from "./validation";

import { db } from "@/lib/db";
import { gameSources, games } from "@/lib/db/schema";

/** A game as shown in the coach's list, with its chapter roll-up. */
export interface GameListItem {
  id: string;
  title: string;
  opponent: string | null;
  playedOn: string | null;
  createdAt: Date;
  sourceCount: number;
  totalDurationS: number;
}

/**
 * Persist a game and its ordered chapter files in one transaction, so a game is
 * never stored without the sources the global-time mapping depends on. The
 * chapter `orderIndex` is the position in `sources` (0-based), matching the
 * `game_sources.order_index` contract in ADR 0002. Shared by the coach-created
 * and auto-ingested paths; `createdBy` is null for a machine ingest.
 */
function persistGameWithSources(input: {
  title: string;
  opponent: string | null;
  playedOn: string | null;
  createdBy: string | null;
  sources: ValidatedGameSource[];
}): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [game] = await tx
      .insert(games)
      .values({
        title: input.title,
        opponent: input.opponent,
        playedOn: input.playedOn,
        createdBy: input.createdBy,
      })
      .returning({ id: games.id });

    await tx.insert(gameSources).values(
      input.sources.map((source, index) => ({
        gameId: game.id,
        orderIndex: index,
        filePath: source.filePath,
        durationS: source.durationS,
      })),
    );

    return { id: game.id };
  });
}

/** Create a coach-authored game and its ordered chapter files. */
export async function createGameWithSources(input: {
  title: string;
  opponent: string | null;
  playedOn: string | null;
  createdBy: string;
  sources: ValidatedGameSource[];
}): Promise<{ id: string }> {
  return persistGameWithSources(input);
}

/**
 * Auto-create a game from the drop-a-folder ingest (P2-9): the stitched chapters
 * and recording date are known, but the game is left in a needs-a-name state -
 * an empty title the coach fills in on the "Neu eingegangen" review (P2-18) -
 * with no opponent and no author, since a machine, not a coach, registered it.
 */
export async function createIngestedGame(input: {
  playedOn: string | null;
  sources: ValidatedGameSource[];
}): Promise<{ id: string }> {
  return persistGameWithSources({
    title: "",
    opponent: null,
    createdBy: null,
    playedOn: input.playedOn,
    sources: input.sources,
  });
}

/** One ordered chapter of a game under review. */
export interface GameReviewSource {
  orderIndex: number;
  filePath: string;
  durationS: number;
}

/** An imported game as the review screen shows it, chapters in play order. */
export interface GameReview {
  id: string;
  title: string;
  opponent: string | null;
  playedOn: string | null;
  sources: GameReviewSource[];
}

/** Load a game and its ordered chapters, or `null` when no such game exists. */
export async function getGameReview(id: string): Promise<GameReview | null> {
  const [game] = await db
    .select({
      id: games.id,
      title: games.title,
      opponent: games.opponent,
      playedOn: games.playedOn,
    })
    .from(games)
    .where(eq(games.id, id))
    .limit(1);
  if (!game) return null;

  const sources = await db
    .select({
      orderIndex: gameSources.orderIndex,
      filePath: gameSources.filePath,
      durationS: gameSources.durationS,
    })
    .from(gameSources)
    .where(eq(gameSources.gameId, id))
    .orderBy(asc(gameSources.orderIndex));

  return { ...game, sources };
}

// Only a game still in the needs-a-name state is under review; matching it in
// the WHERE clause makes accept and discard no-ops on an already accepted game,
// so a stale review tab can never rename or delete a game the coach works with.
const stillUnderReview = sql`btrim(${games.title}) = ''`;

/**
 * Accept an imported game: give it a title, opponent and date, which moves it
 * out of the review list into the normal games list. Returns whether a game
 * still under review matched, so the caller reports a stale review.
 */
export async function acceptImportedGame(
  id: string,
  review: { title: string; opponent: string | null; playedOn: string },
): Promise<{ updated: boolean }> {
  const rows = await db
    .update(games)
    .set({
      title: review.title,
      opponent: review.opponent,
      playedOn: review.playedOn,
    })
    .where(and(eq(games.id, id), stillUnderReview))
    .returning({ id: games.id });
  return { updated: rows.length > 0 };
}

/**
 * Discard an imported game. Its `game_sources` rows (and anything else hanging
 * off the game) go with it through the `ON DELETE CASCADE` foreign keys; the
 * video files themselves are never touched. Returns whether a game still under
 * review matched.
 */
export async function discardImportedGame(
  id: string,
): Promise<{ deleted: boolean }> {
  const rows = await db
    .delete(games)
    .where(and(eq(games.id, id), stillUnderReview))
    .returning({ id: games.id });
  return { deleted: rows.length > 0 };
}

/**
 * List every game with its chapter count and total duration, newest game first.
 * Games are a shared team workspace, so this is not scoped to one coach.
 */
export async function listGames(): Promise<GameListItem[]> {
  return db
    .select({
      id: games.id,
      title: games.title,
      opponent: games.opponent,
      playedOn: games.playedOn,
      createdAt: games.createdAt,
      sourceCount: sql<number>`count(${gameSources.id})`.mapWith(Number),
      totalDurationS:
        sql<number>`coalesce(sum(${gameSources.durationS}), 0)`.mapWith(Number),
    })
    .from(games)
    .leftJoin(gameSources, eq(gameSources.gameId, games.id))
    .groupBy(games.id)
    .orderBy(desc(games.playedOn), desc(games.createdAt));
}
