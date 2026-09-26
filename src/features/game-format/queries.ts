/**
 * Database access for the game format: the team default in the one-row
 * `team_settings` table and each game's own `period_count` /
 * `period_length_s`. Every reader goes through {@link resolveGameFormat}, so a
 * page never assumes 4 x 15.
 */
import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import {
  DEFAULT_GAME_FORMAT,
  resolveGameFormat,
  type GameFormat,
  type GameFormatOverride,
} from "./format";

import { db } from "@/lib/db";
import { games, quarters, teamSettings } from "@/lib/db/schema";

/** The only row of `team_settings`; the schema pins its id to 1. */
const TEAM_SETTINGS_ID = 1;

type Executor = Pick<typeof db, "select">;

async function readTeamFormat(executor: Executor): Promise<GameFormat> {
  const [row] = await executor
    .select({
      periodCount: teamSettings.periodCount,
      periodLengthS: teamSettings.periodLengthS,
    })
    .from(teamSettings)
    .where(eq(teamSettings.id, TEAM_SETTINGS_ID))
    .limit(1);
  // The migration seeds the row; should it be gone, the built-in default holds.
  return row
    ? resolveGameFormat(row, DEFAULT_GAME_FORMAT)
    : DEFAULT_GAME_FORMAT;
}

/** The team's default game format. */
export async function getTeamGameFormat(): Promise<GameFormat> {
  return readTeamFormat(db);
}

/**
 * Set the team's default game format. A game that follows the default and
 * already has periods marked keeps the format it was marked in: it is pinned
 * to the old default in the same transaction, so its clock and period split
 * never change behind the coach's back. Games with nothing marked yet (a fresh
 * import, say) follow the new default.
 */
export async function setTeamGameFormat(format: GameFormat): Promise<void> {
  await db.transaction(async (tx) => {
    const previous = await readTeamFormat(tx);
    if (
      previous.periodCount === format.periodCount &&
      previous.periodLengthS === format.periodLengthS
    ) {
      return;
    }
    const hasMarkedPeriods = sql`exists (select 1 from ${quarters} where ${quarters.gameId} = ${games.id})`;

    await tx
      .update(games)
      .set({ periodCount: previous.periodCount })
      .where(and(isNull(games.periodCount), hasMarkedPeriods));
    await tx
      .update(games)
      .set({ periodLengthS: previous.periodLengthS })
      .where(and(isNull(games.periodLengthS), hasMarkedPeriods));

    await tx
      .insert(teamSettings)
      .values({ id: TEAM_SETTINGS_ID, ...format })
      .onConflictDoUpdate({ target: teamSettings.id, set: { ...format } });
  });
}

/** A game's format as its settings show it. */
export interface GameFormatSetting {
  readonly title: string;
  /** The game's own columns; both null when it plays the team default. */
  readonly override: GameFormatOverride;
  /** The team default the game falls back to. */
  readonly teamDefault: GameFormat;
  /** The format the game plays. */
  readonly format: GameFormat;
  /** The highest period index marked on the game, 0 when none is. */
  readonly markedPeriods: number;
}

// A game id is a UUID; reject anything else before it reaches Postgres, which
// would otherwise error on a malformed uuid cast rather than simply not match.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Load a game's format, or `null` when the id is malformed or no such game
 * exists (the caller renders a 404).
 */
export async function loadGameFormatSetting(
  gameId: string,
): Promise<GameFormatSetting | null> {
  if (!UUID_PATTERN.test(gameId)) return null;
  const [[game], teamDefault, [marked]] = await Promise.all([
    db
      .select({
        title: games.title,
        periodCount: games.periodCount,
        periodLengthS: games.periodLengthS,
      })
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1),
    getTeamGameFormat(),
    db
      .select({ highest: sql<number>`coalesce(max(${quarters.index}), 0)` })
      .from(quarters)
      .where(eq(quarters.gameId, gameId)),
  ]);
  if (!game) return null;
  const override = {
    periodCount: game.periodCount,
    periodLengthS: game.periodLengthS,
  };
  return {
    title: game.title,
    override,
    teamDefault,
    format: resolveGameFormat(override, teamDefault),
    markedPeriods: Number(marked?.highest ?? 0),
  };
}

/** The format a game plays, or `null` when no such game exists. */
export async function getGameFormat(
  gameId: string,
): Promise<GameFormat | null> {
  return (await loadGameFormatSetting(gameId))?.format ?? null;
}

/**
 * Set a game's own format, or clear it (`null`) so it plays the team default.
 * Periods marked past the new period count - the 3rd and 4th quarter of a game
 * switched to two halves - are removed in the same transaction, so the stored
 * periods always fit the format; the form warns before it saves. Returns
 * `false` when no such game exists.
 */
export async function updateGameFormat(
  gameId: string,
  format: GameFormat | null,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(games)
      .set({
        periodCount: format?.periodCount ?? null,
        periodLengthS: format?.periodLengthS ?? null,
      })
      .where(eq(games.id, gameId))
      .returning({ id: games.id });
    if (!updated) return false;

    const periodCount = (format ?? (await readTeamFormat(tx))).periodCount;
    await tx
      .delete(quarters)
      .where(and(eq(quarters.gameId, gameId), gt(quarters.index, periodCount)));
    return true;
  });
}
