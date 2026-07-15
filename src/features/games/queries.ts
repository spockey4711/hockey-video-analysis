/**
 * Database access for the games flow. Thin wrappers over the `games` and
 * `game_sources` tables so the server action and pages stay readable and the SQL
 * lives in one place.
 */
import "server-only";
import { desc, eq, sql } from "drizzle-orm";

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
 * Create a game and its ordered chapter files in one transaction, so a game is
 * never persisted without the sources the global-time mapping depends on. The
 * chapter `orderIndex` is the position in `sources` (0-based), matching the
 * `game_sources.order_index` contract in ADR 0002.
 */
export async function createGameWithSources(input: {
  title: string;
  opponent: string | null;
  playedOn: string | null;
  createdBy: string;
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
