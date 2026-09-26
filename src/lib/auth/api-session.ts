/**
 * Authentication for route handlers, the one surface that accepts the Mac
 * app's bearer token next to the browser's cookie (ADR 0013).
 *
 * A request that carries an `Authorization` header is judged by that header
 * alone: it must be a well-formed `Bearer` token of a device session, sent to a
 * path under `/api/`. Without the header the cookie decides, as on every page.
 * The token never appears in a log line or an error message here.
 */
import "server-only";

import { API_PATH_PREFIX } from "./config";
import { getCurrentSession } from "./current-coach";
import { validateSessionToken, type ActiveSession } from "./session";

// The Mac sends the hex token `generateSessionToken` made; anything else is not
// one of ours, so it is refused before it reaches the database.
const BEARER = /^Bearer ([0-9a-f]{64})$/;

/**
 * The raw bearer token of an `Authorization` header value: the token, `null`
 * for a header that is present but not a well-formed bearer token, or
 * `undefined` when there is no header at all.
 */
export function readBearerToken(
  header: string | null,
): string | null | undefined {
  if (header === null) return undefined;
  return BEARER.exec(header.trim())?.[1] ?? null;
}

/** True for a path the bearer token may be presented to. */
export function isApiPath(pathname: string): boolean {
  return pathname.startsWith(API_PATH_PREFIX);
}

/**
 * The session behind a route handler request: a device session from its bearer
 * token, else the browser's web session from its cookie; `null` when neither
 * is valid.
 */
export async function getApiSession(
  request: Request,
): Promise<ActiveSession | null> {
  const bearer = readBearerToken(request.headers.get("authorization"));
  if (bearer === undefined) return getCurrentSession();
  if (bearer === null || !isApiPath(new URL(request.url).pathname)) {
    return null;
  }
  return validateSessionToken(bearer, "device");
}
