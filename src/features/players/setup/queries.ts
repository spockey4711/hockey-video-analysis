/**
 * Database access for setting up the roster: adding a player and editing an
 * existing player's name and jersey number. A new player gets a fresh share
 * token from the same generator rotation uses, so every per-player link carries
 * the same 256-bit entropy floor. Editing never touches the token - changing a
 * name must not revoke a link the coach already handed out.
 */
import "server-only";
import { eq } from "drizzle-orm";

import type { ValidatedPlayer } from "./validation";

import { generateShareToken } from "@/features/access/rotation/token";
import { db } from "@/lib/db";
import { players } from "@/lib/db/schema";

/** Postgres unique-violation code, raised if a fresh token collides (astronomically rare). */
const PG_UNIQUE_VIOLATION = "23505";

// `share_token` is `unique`; retry the vanishing chance of a collision rather
// than surface a spurious failure (same policy as rotation).
const MAX_ATTEMPTS = 3;

/** Insert a player with a fresh share token and return its id. */
export async function createPlayer(
  player: ValidatedPlayer,
): Promise<{ id: string }> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const [row] = await db
        .insert(players)
        .values({ ...player, shareToken: generateShareToken() })
        .returning({ id: players.id });
      if (!row) throw new Error("Insert returned no row.");
      return row;
    } catch (cause) {
      if (isUniqueViolation(cause) && attempt < MAX_ATTEMPTS) continue;
      throw cause;
    }
  }
}

/**
 * Update a player's name and jersey number, returning `true` when a row changed
 * or `false` when the id matches no player (the action reports a not-found
 * without confirming which ids exist).
 */
export async function updatePlayer(
  playerId: string,
  player: ValidatedPlayer,
): Promise<boolean> {
  const rows = await db
    .update(players)
    .set(player)
    .where(eq(players.id, playerId))
    .returning({ id: players.id });
  return rows.length > 0;
}

function isUniqueViolation(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}
