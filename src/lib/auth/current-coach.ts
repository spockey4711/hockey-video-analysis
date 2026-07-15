/**
 * The request-scoped "who is signed in" helper that the rest of the app reads.
 * Wrapped in React `cache` so multiple callers in one render (layout, page,
 * server action) share a single cookie read and session lookup.
 *
 * This is read-only: it never writes a cookie, so it is safe to call from a
 * Server Component. Later tasks stamp `author` on content from the returned id.
 */
import "server-only";
import { cache } from "react";

import { getSessionCookie } from "./cookies";
import { validateSessionToken, type SessionCoach } from "./session";

/** The signed-in coach, or `null` if the request has no valid session. */
export const getCurrentCoach = cache(async (): Promise<SessionCoach | null> => {
  const token = await getSessionCookie();
  if (!token) return null;
  const session = await validateSessionToken(token);
  return session?.coach ?? null;
});
