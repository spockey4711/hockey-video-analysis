/**
 * The request-scoped "who is signed in" helpers that the rest of the app reads.
 * Wrapped in React `cache` so multiple callers in one render (layout, page,
 * server action) share a single cookie read and session lookup.
 *
 * These read the cookie only, so pages and Server Actions never accept the Mac
 * app's bearer token (route handlers use `getApiSession` for that). They never
 * write a cookie, so they are safe to call from a Server Component; the only
 * write is the hourly `last_seen_at` bump on the session row.
 */
import "server-only";
import { cache } from "react";

import { getSessionCookie } from "./cookies";
import {
  validateSessionToken,
  type ActiveSession,
  type SessionCoach,
} from "./session";

/** This browser's session, or `null` if the request has no valid one. */
export const getCurrentSession = cache(
  async (): Promise<ActiveSession | null> => {
    const token = await getSessionCookie();
    if (!token) return null;
    return validateSessionToken(token, "web");
  },
);

/** The signed-in coach, or `null` if the request has no valid session. */
export const getCurrentCoach = cache(async (): Promise<SessionCoach | null> => {
  const session = await getCurrentSession();
  return session?.coach ?? null;
});
