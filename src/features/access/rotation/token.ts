/**
 * Generation of a player's `share_token` (P1-6).
 *
 * Unlike a session token (stored only as a SHA-256 hash - see `lib/auth/tokens`),
 * a player's share token is stored verbatim and looked up by equality when a
 * secret link is opened, so the value in the database *is* the secret handed out
 * in the URL. It must therefore be high-entropy and unguessable: a read of the
 * `players` table already yields working links, so the token's only defence is
 * that it cannot be predicted. Rotating it to a fresh value is what revokes an
 * old link (the old value stops resolving), so generation lives here beside the
 * rotation query rather than in the login-token module.
 */

// 32 bytes = 256 bits of entropy, hex-encoded for a URL-safe string. Matches the
// session-token width; the two are independent but share the same entropy floor.
const TOKEN_BYTES = 32;

/** Generate a fresh, unguessable player share token to place in a secret link. */
export function generateShareToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
