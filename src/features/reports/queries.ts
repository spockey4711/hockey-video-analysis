/**
 * Server-side reads for the game report and the team overview (P2-12): the
 * game facts plus everything {@link buildGameReport} and {@link buildTeamReport}
 * aggregate - the tags with their player links, the linked players and, for a
 * single game, the marked quarters. Read-only over the existing tables; the
 * reports derive their figures and capture nothing new.
 */
import "server-only";
import { and, asc, desc, eq, gte, lte, type SQL } from "drizzle-orm";

import type { ReportPlayer, ReportTag } from "./report";
import type { ReportRange } from "./report-range";
import type { TeamReportGame, TeamReportTag } from "./team-report";

import {
  resolveGameFormat,
  type PeriodCount,
} from "@/features/game-format/format";
import { getTeamGameFormat } from "@/features/game-format/queries";
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

/** One tag-to-player link row, with the player's facts. */
interface PlayerLinkRow {
  readonly tagId: string;
  readonly playerId: string;
  readonly name: string;
  readonly jerseyNumber: number | null;
}

/** Index link rows by tag, and collect each linked player once. */
function groupPlayerLinks(linkRows: readonly PlayerLinkRow[]): {
  playerIdsByTag: Map<string, string[]>;
  playersById: Map<string, ReportPlayer>;
} {
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
  return { playerIdsByTag, playersById };
}

/** Everything the report page and the CSV export need for one game. */
export interface GameReportData {
  readonly game: ReportGame;
  /** The periods the game plays, which name its period split. */
  readonly periodCount: PeriodCount;
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

  const [gameRow] = await db
    .select({
      id: games.id,
      title: games.title,
      opponent: games.opponent,
      playedOn: games.playedOn,
      periodCount: games.periodCount,
      periodLengthS: games.periodLengthS,
    })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!gameRow) return null;
  const { periodCount, periodLengthS, ...game } = gameRow;

  const [tagRows, linkRows, quarterRows, teamFormat] = await Promise.all([
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
    getTeamGameFormat(),
  ]);

  const { playerIdsByTag, playersById } = groupPlayerLinks(linkRows);

  return {
    game,
    periodCount: resolveGameFormat({ periodCount, periodLengthS }, teamFormat)
      .periodCount,
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

/** Everything the team overview page and its CSV export need. */
export interface TeamReportData {
  readonly games: readonly TeamReportGame[];
  readonly tags: readonly TeamReportTag[];
  readonly players: readonly ReportPlayer[];
}

/** Games whose played-on date lies in the range (all games when it is open). */
function gamesInRange(range: ReportRange): SQL | undefined {
  // A bound compares against NULL as unknown, so a set range drops undated games.
  return and(
    range.from ? gte(games.playedOn, range.from) : undefined,
    range.to ? lte(games.playedOn, range.to) : undefined,
  );
}

/**
 * Load the team overview inputs for the games in the range: the games in the
 * games list's order (newest first), their tags with player links, and the
 * players linked to any of those tags. Games are a shared team workspace, so
 * this is not scoped to one coach.
 */
export async function loadTeamReportData(
  range: ReportRange,
): Promise<TeamReportData> {
  const where = gamesInRange(range);

  const [gameRows, tagRows, linkRows] = await Promise.all([
    db
      .select({
        id: games.id,
        title: games.title,
        opponent: games.opponent,
        playedOn: games.playedOn,
      })
      .from(games)
      .where(where)
      .orderBy(desc(games.playedOn), desc(games.createdAt)),
    db
      .select({
        id: tags.id,
        gameId: tags.gameId,
        type: tags.type,
        startS: tags.startS,
      })
      .from(tags)
      .innerJoin(games, eq(games.id, tags.gameId))
      .where(where),
    db
      .select({
        tagId: tagPlayers.tagId,
        playerId: players.id,
        name: players.name,
        jerseyNumber: players.jerseyNumber,
      })
      .from(tagPlayers)
      .innerJoin(tags, eq(tags.id, tagPlayers.tagId))
      .innerJoin(games, eq(games.id, tags.gameId))
      .innerJoin(players, eq(players.id, tagPlayers.playerId))
      .where(where),
  ]);

  const { playerIdsByTag, playersById } = groupPlayerLinks(linkRows);
  return {
    games: gameRows,
    tags: tagRows.map((tag) => ({
      ...tag,
      playerIds: playerIdsByTag.get(tag.id) ?? [],
    })),
    players: [...playersById.values()],
  };
}
