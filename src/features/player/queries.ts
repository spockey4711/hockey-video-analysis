/**
 * Server-side read for the watch page: a game and its ordered chapter files.
 *
 * This lane owns the watch route, so it reads the existing `games` /
 * `game_sources` tables directly (the schema is fixed since P0-1; later tasks
 * only add queries). Chapters come back in `order_index` order, which is exactly
 * the chapter coordinate the global game-time mapping expects (ADR 0002).
 */
import "server-only";
import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { gameSources, games } from "@/lib/db/schema";

/** A game ready to watch, with its ordered chapter files. */
export interface WatchGame {
  readonly id: string;
  readonly title: string;
  readonly opponent: string | null;
  readonly playedOn: string | null;
  readonly chapters: readonly {
    readonly filePath: string;
    readonly durationS: number;
  }[];
}

// A game id is a UUID; reject anything else before it reaches Postgres, which
// would otherwise error on a malformed uuid cast rather than simply not match.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Load a game and its ordered chapters for playback, or `null` when the id is
 * malformed or no such game exists (the caller renders a 404). Returns the game
 * even with zero chapters so the caller can distinguish "no game" from "game
 * with no video yet".
 */
export async function loadWatchGame(gameId: string): Promise<WatchGame | null> {
  if (!UUID_PATTERN.test(gameId)) return null;

  const gameRows = await db
    .select({
      id: games.id,
      title: games.title,
      opponent: games.opponent,
      playedOn: games.playedOn,
    })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  const game = gameRows[0];
  if (!game) return null;

  const chapters = await db
    .select({
      filePath: gameSources.filePath,
      durationS: gameSources.durationS,
    })
    .from(gameSources)
    .where(eq(gameSources.gameId, gameId))
    .orderBy(asc(gameSources.orderIndex));

  return { ...game, chapters };
}
