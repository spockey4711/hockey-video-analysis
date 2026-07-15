/**
 * Database access for rotating a player's `share_token` (P1-6). Rotation writes
 * a fresh unguessable token over the old one; because a secret link resolves by
 * matching `players.share_token` exactly (see the per-player share query), the
 * previous value stops resolving the instant it is overwritten - that overwrite
 * *is* the link revocation. The SQL lives here so the action stays readable.
 */
import "server-only";
import { eq } from "drizzle-orm";

import { generateShareToken } from "./token";

import { db } from "@/lib/db";
import { players } from "@/lib/db/schema";

/** Postgres unique-violation code, raised if a fresh token collides (astronomically rare). */
const PG_UNIQUE_VIOLATION = "23505";

// A 256-bit random token colliding with an existing one is astronomically
// unlikely, but `share_token` is `unique`, so retry a few times rather than
// surface a spurious failure on the vanishing chance it happens.
const MAX_ATTEMPTS = 3;

/** The outcome of a rotation: the freshly issued token that now revokes the old link. */
export interface RotatedShareToken {
  readonly shareToken: string;
}

/**
 * Replace a player's share token with a fresh one and return it, or `null` when
 * the id matches no player (the action reports a not-found without confirming
 * which ids exist). Retries on the rare unique-constraint collision so a caller
 * never sees a spurious failure.
 */
export async function rotatePlayerShareToken(
  playerId: string,
): Promise<RotatedShareToken | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const shareToken = generateShareToken();
    try {
      const rows = await db
        .update(players)
        .set({ shareToken })
        .where(eq(players.id, playerId))
        .returning({ shareToken: players.shareToken });
      return rows[0] ?? null;
    } catch (cause) {
      if (isUniqueViolation(cause) && attempt < MAX_ATTEMPTS) continue;
      throw cause;
    }
  }
  // Unreachable: the loop either returns or throws on its last attempt.
  return null;
}

function isUniqueViolation(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}
