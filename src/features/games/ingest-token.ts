/**
 * The drop-a-folder ingest endpoint's shared secret (P2-9).
 *
 * Auto-ingest is machine-to-machine: the hockey-video-pipeline stitches a game's
 * chapter files and then calls `POST /api/ingest` to register it. There is no
 * coach session on that call, so it authenticates with a server-only shared
 * secret, `INGEST_TOKEN`, presented as `Authorization: Bearer <token>`. It is a
 * secret (see CLAUDE.md "share tokens are secrets too") and never reaches the
 * browser.
 *
 * Leaving `INGEST_TOKEN` unset disables auto-ingest entirely: with no expected
 * token, no candidate can ever match, so the route rejects every request.
 */
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** The configured ingest token, or `undefined` when auto-ingest is disabled. */
export function getIngestToken(): string | undefined {
  const token = process.env.INGEST_TOKEN?.trim();
  return token && token.length > 0 ? token : undefined;
}

/**
 * Whether an untrusted bearer token from the request matches the configured
 * ingest token. Both sides are SHA-256 hashed before comparison so the compare
 * runs on equal-length buffers in constant time - it leaks neither the token's
 * length nor where a mismatch first diverges. Returns false when auto-ingest is
 * disabled.
 */
export function verifyIngestToken(candidate: unknown): boolean {
  const expected = getIngestToken();
  if (!expected) return false;
  if (typeof candidate !== "string" || candidate.length === 0) return false;

  const expectedHash = createHash("sha256").update(expected).digest();
  const candidateHash = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expectedHash, candidateHash);
}

/**
 * Extract the bearer credential from an `Authorization` header value. Returns
 * `null` for a missing, malformed, or non-bearer header so the caller can reject
 * without special-casing each shape.
 */
export function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer[ ](.+)$/.exec(header.trim());
  return match ? match[1].trim() : null;
}
