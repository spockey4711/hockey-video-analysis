/**
 * The team share link's secret token (P0-10).
 *
 * The token lives in the one `team_settings` row (`team_share_token`), stored
 * verbatim like a player's `share_token`: one team, one deployment, one
 * unguessable link. The coach replaces it under Einstellungen > Teilen, and
 * the old value stops resolving at once - every check reads the row, so an
 * already-open team page loses its comments and 404s on its next load. It is a
 * secret (see CLAUDE.md "share tokens are secrets too") and never reaches the
 * browser beyond the share URL shown to the signed-in coach.
 *
 * The server-only `TEAM_SHARE_TOKEN` env value only seeds the first token:
 * while the row has none, the first read copies the env value in, and from
 * then on the row alone decides. With neither, the team clip view stays off
 * (the route 404s) until the coach creates a link.
 */
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { generateShareToken } from "@/features/access/rotation/token";
import { db } from "@/lib/db";
import { teamSettings } from "@/lib/db/schema";

/** The only row of `team_settings`; the schema pins its id to 1. */
const TEAM_SETTINGS_ID = 1;

/** The `TEAM_SHARE_TOKEN` seed, or `undefined` when unset or blank. */
function envSeed(): string | undefined {
  const token = process.env.TEAM_SHARE_TOKEN?.trim();
  return token && token.length > 0 ? token : undefined;
}

/**
 * Copy the env seed into the row, unless a token got there first (a
 * concurrent seed, or a link the coach just created), and return the token
 * the row now holds. Also creates the row should it be missing.
 */
async function seedTeamShareToken(seed: string): Promise<string | undefined> {
  const [row] = await db
    .insert(teamSettings)
    .values({ id: TEAM_SETTINGS_ID, teamShareToken: seed })
    .onConflictDoUpdate({
      target: teamSettings.id,
      set: {
        teamShareToken: sql`coalesce(${teamSettings.teamShareToken}, excluded.team_share_token)`,
      },
    })
    .returning({ token: teamSettings.teamShareToken });
  return row?.token ?? undefined;
}

/** The team share token, or `undefined` while the team view is off. */
export async function getTeamShareToken(): Promise<string | undefined> {
  const [row] = await db
    .select({ token: teamSettings.teamShareToken })
    .from(teamSettings)
    .where(eq(teamSettings.id, TEAM_SETTINGS_ID))
    .limit(1);
  if (row?.token) return row.token;

  const seed = envSeed();
  return seed ? seedTeamShareToken(seed) : undefined;
}

/**
 * Replace the team share token with a fresh one and return it. The previous
 * token stops resolving as soon as this commits, which is what revokes the
 * old link; it also turns the team view on when it was off.
 */
export async function regenerateTeamShareToken(): Promise<string> {
  const token = generateShareToken();
  await db
    .insert(teamSettings)
    .values({ id: TEAM_SETTINGS_ID, teamShareToken: token })
    .onConflictDoUpdate({
      target: teamSettings.id,
      set: { teamShareToken: token, updatedAt: new Date() },
    });
  return token;
}

/**
 * Whether an untrusted candidate from the URL matches the team token. Both
 * sides are SHA-256 hashed before comparison so the compare runs on
 * equal-length buffers in constant time - it leaks neither the token's length
 * nor where a mismatch first diverges. False while the team view is off.
 */
export async function verifyTeamShareToken(
  candidate: unknown,
): Promise<boolean> {
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  const expected = await getTeamShareToken();
  if (!expected) return false;

  const expectedHash = createHash("sha256").update(expected).digest();
  const candidateHash = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expectedHash, candidateHash);
}
