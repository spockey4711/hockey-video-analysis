/**
 * Auth configuration constants shared across the session, cookie and guard
 * helpers. Kept dependency-free so both server modules and tests can import it.
 */

/** Name of the HttpOnly cookie that carries the raw session token. */
export const SESSION_COOKIE_NAME = "hva_session";

/** How long a session stays valid after login, in milliseconds (30 days). */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/** Where an unauthenticated coach is sent to sign in. */
export const LOGIN_PATH = "/login";

/** Where a coach lands after a successful login or signup. */
export const DEFAULT_REDIRECT = "/";

/** Query key used to remember the page a coach was heading to before login. */
export const NEXT_PARAM = "next";
