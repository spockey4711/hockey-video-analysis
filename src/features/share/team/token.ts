/**
 * The team share link's secret token (P0-10).
 *
 * The schema (frozen since P0-1) carries a per-player `share_token` but no
 * team-wide one, so the single team link's secret lives in the server-only
 * `TEAM_SHARE_TOKEN` environment variable instead: one team, one deployment, one
 * unguessable link, rotatable by changing the env value. It is a secret (see
 * CLAUDE.md "share tokens are secrets too") and never reaches the browser.
 *
 * Leaving `TEAM_SHARE_TOKEN` unset disables the team clip view entirely: with no
 * expected token, no candidate can ever match, so the route 404s.
 */
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** The configured team share token, or `undefined` when the view is disabled. */
export function getTeamShareToken(): string | undefined {
  const token = process.env.TEAM_SHARE_TOKEN?.trim();
  return token && token.length > 0 ? token : undefined;
}

/**
 * Whether an untrusted candidate from the URL matches the configured team
 * token. Both sides are SHA-256 hashed before comparison so the compare runs on
 * equal-length buffers in constant time - it leaks neither the token's length
 * nor where a mismatch first diverges. Returns false when the view is disabled.
 */
export function verifyTeamShareToken(candidate: unknown): boolean {
  const expected = getTeamShareToken();
  if (!expected) return false;
  if (typeof candidate !== "string" || candidate.length === 0) return false;

  const expectedHash = createHash("sha256").update(expected).digest();
  const candidateHash = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expectedHash, candidateHash);
}
