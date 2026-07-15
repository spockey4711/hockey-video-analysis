/**
 * Session token generation and hashing.
 *
 * The raw token is a high-entropy secret handed to the browser in a cookie; the
 * database stores only its SHA-256 hash as the session id. A read-only leak of
 * the `sessions` table therefore yields no usable tokens - the same reason we
 * never store the raw value server-side.
 */
import { createHash, randomBytes } from "node:crypto";

// 32 bytes = 256 bits of entropy, hex-encoded for a URL/cookie-safe string.
const TOKEN_BYTES = 32;

/** Generate a fresh, unguessable session token to send to the client. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/** Derive the stored session id (SHA-256 hex) from a raw token. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
