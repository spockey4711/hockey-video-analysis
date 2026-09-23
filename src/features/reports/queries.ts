/**
 * Server-side read for the game report (P2-12): the game's header facts plus
 * everything {@link buildGameReport} aggregates - its tags with their player
 * links, the linked players and the marked quarters. Read-only over the
 * existing tables; the report derives its figures and captures nothing new.
 */
import "server-only";
import { asc, eq } from "drizzle-orm";

import type { ReportPlayer, ReportTag } from "./report";

import type { Quarter } from "@/features/quarters/navigation";
import { listQuarters } from "@/features/quarters/queries";
import { db } from "@/lib/db";
import { games, players, tagPlayers, tags } from "@/lib/db/schema";

/** The game facts shown in the report header and used for the file name. */
export interface ReportGame {
  readonly id: string;
  readonly title: string;
  readonly opponent: string | null;
  readonly playedOn: string | null;
}

/** Everything the report page and the CSV export need for one game. */
export interface GameReportData {
  readonly game: ReportGame;
  readonly tags: readonly ReportTag[];
  readonly players: readonly ReportPlayer[];
  readonly quarters: readonly Quarter[];
}

// A game id is a UUID; reject anything else before it reaches Postgres, which
// would otherwise error on a malformed uuid cast rather than simply not match.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Load a game's report inputs, or `null` when the id is malformed or no such
 * game exists (the caller renders a 404). Tags come in start-time order; the
 * players are only those linked to at least one of the game's tags.
 */
export async function loadGameReportData(
  gameId: string,
): Promise<GameReportData | null> {
  if (!UUID_PATTERN.test(gameId)) return null;

  const [game] = await db
    .select({
      id: games.id,
      title: games.title,
      opponent: games.opponent,
      playedOn: games.playedOn,
    })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!game) return null;

  const [tagRows, linkRows, quarterRows] = await Promise.all([
    db
      .select({ id: tags.id, type: tags.type, startS: tags.startS })
      .from(tags)
      .where(eq(tags.gameId, gameId))
      .orderBy(asc(tags.startS)),
    db
      .select({
        tagId: tagPlayers.tagId,
        playerId: players.id,
        name: players.name,
        jerseyNumber: players.jerseyNumber,
      })
      .from(tagPlayers)
      .innerJoin(tags, eq(tags.id, tagPlayers.tagId))
      .innerJoin(players, eq(players.id, tagPlayers.playerId))
      .where(eq(tags.gameId, gameId)),
    listQuarters(gameId),
  ]);

  const playerIdsByTag = new Map<string, string[]>();
  const playersById = new Map<string, ReportPlayer>();
  for (const link of linkRows) {
    const ids = playerIdsByTag.get(link.tagId) ?? [];
    ids.push(link.playerId);
    playerIdsByTag.set(link.tagId, ids);
    playersById.set(link.playerId, {
      id: link.playerId,
      name: link.name,
      jerseyNumber: link.jerseyNumber,
    });
  }

  return {
    game,
    tags: tagRows.map((tag) => ({
      ...tag,
      playerIds: playerIdsByTag.get(tag.id) ?? [],
    })),
    players: [...playersById.values()],
    quarters: quarterRows.map(({ index, startS, endS }) => ({
      index,
      startS,
      endS,
    })),
  };
}
