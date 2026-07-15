/**
 * Database access for the quarter split (P1-4). Thin wrappers over the
 * `quarters` table so the route handler stays readable and the SQL lives in one
 * place. A game's quarters are always read and written as a whole set.
 */
import "server-only";
import { asc, eq } from "drizzle-orm";

import type { QuartersInput } from "./validation";

import { db } from "@/lib/db";
import { quarters } from "@/lib/db/schema";

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

/**
 * Replace a game's whole quarter set in one transaction: delete the existing
 * rows, then insert the validated set. Setting quarters is a full overwrite - a
 * coach edits the boundaries as a unit - so this avoids partial-update states
 * and keeps the `(game_id, index)` unique constraint trivially satisfied.
 * Inserting against a missing `gameId` raises a foreign-key violation the route
 * turns into a 400.
 */
export async function replaceQuarters(
  input: QuartersInput,
): Promise<QuarterRow[]> {
  return db.transaction(async (tx) => {
    await tx.delete(quarters).where(eq(quarters.gameId, input.gameId));
    const inserted = await tx
      .insert(quarters)
      .values(
        input.quarters.map((quarter) => ({
          gameId: input.gameId,
          index: quarter.index,
          startS: quarter.startS,
          endS: quarter.endS,
        })),
      )
      .returning(returning);
    return inserted.sort((a, b) => a.index - b.index);
  });
}
