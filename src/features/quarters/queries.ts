/**
 * Database access for the quarter split (P1-4). Thin wrappers over the
 * `quarters` table so the route handler stays readable and the SQL lives in one
 * place. A game's quarters are always read and written as a whole set.
 */
import "server-only";
import { and, asc, eq, notInArray, sql } from "drizzle-orm";

import type { QuartersInput } from "./validation";

import { db } from "@/lib/db";
import { games, quarters } from "@/lib/db/schema";

/** A persisted quarter row for a game, ordered by `index`. */
export interface QuarterRow {
  id: string;
  gameId: string;
  index: number;
  startS: number;
  endS: number | null;
}

const returning = {
  id: quarters.id,
  gameId: quarters.gameId,
  index: quarters.index,
  startS: quarters.startS,
  endS: quarters.endS,
} as const;

/** List a game's quarters in index order (empty when none are set yet). */
export async function listQuarters(gameId: string): Promise<QuarterRow[]> {
  return db
    .select(returning)
    .from(quarters)
    .where(eq(quarters.gameId, gameId))
    .orderBy(asc(quarters.index));
}

/** A game's quarter set with its version (ADR 0013): saved as one unit. */
export interface QuarterSet {
  quarters: QuarterRow[];
  version: number;
}

/** The result of saving a quarter set that may name its base version. */
export type QuartersWriteOutcome =
  | { readonly status: "done"; readonly value: QuarterSet }
  | { readonly status: "not-found" }
  | { readonly status: "conflict"; readonly current: QuarterSet };

type Executor = Pick<typeof db, "select">;

async function readQuarterSet(
  gameId: string,
  version: number,
  executor: Executor,
): Promise<QuarterSet> {
  const rows = await executor
    .select(returning)
    .from(quarters)
    .where(eq(quarters.gameId, gameId))
    .orderBy(asc(quarters.index));
  return { quarters: rows, version };
}

/**
 * Replace a game's whole quarter set in one transaction. A coach edits the
 * boundaries as a unit, so this is a full overwrite, written as the difference
 * to the stored set: periods no longer in the set are deleted, the rest are
 * inserted or updated by index. A save that changes nothing leaves the set's
 * version alone, so it never makes another device's edit look stale.
 *
 * `baseVersion` is the set version the save started from (`If-Match`): when
 * the set has moved past it, nothing is written and the current set comes back
 * as a conflict. `null` saves without the check, as the web does. A game that
 * does not exist is `not-found`.
 */
export async function replaceQuarters(
  input: QuartersInput,
  baseVersion: number | null = null,
): Promise<QuartersWriteOutcome> {
  return db.transaction(async (tx) => {
    // Lock the game so two saves of its quarters cannot interleave.
    const [game] = await tx
      .select({ version: games.quartersVersion })
      .from(games)
      .where(eq(games.id, input.gameId))
      .for("update");
    if (!game) return { status: "not-found" };
    if (baseVersion !== null && game.version !== baseVersion) {
      return {
        status: "conflict",
        current: await readQuarterSet(input.gameId, game.version, tx),
      };
    }

    const indexes = input.quarters.map((quarter) => quarter.index);
    await tx
      .delete(quarters)
      .where(
        indexes.length > 0
          ? and(
              eq(quarters.gameId, input.gameId),
              notInArray(quarters.index, indexes),
            )
          : eq(quarters.gameId, input.gameId),
      );
    if (input.quarters.length > 0) {
      await tx
        .insert(quarters)
        .values(
          input.quarters.map((quarter) => ({
            gameId: input.gameId,
            index: quarter.index,
            startS: quarter.startS,
            endS: quarter.endS,
          })),
        )
        .onConflictDoUpdate({
          target: [quarters.gameId, quarters.index],
          set: {
            startS: sql`excluded.start_s`,
            endS: sql`excluded.end_s`,
          },
          setWhere: sql`(${quarters.startS}, ${quarters.endS}) is distinct from (excluded.start_s, excluded.end_s)`,
        });
    }

    // The triggers bumped the set's version for every period that moved.
    const [saved] = await tx
      .select({ version: games.quartersVersion })
      .from(games)
      .where(eq(games.id, input.gameId));
    return {
      status: "done",
      value: await readQuarterSet(
        input.gameId,
        saved?.version ?? game.version,
        tx,
      ),
    };
  });
}
