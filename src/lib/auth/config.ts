/**
 * Auth configuration constants shared across the session, cookie and guard
 * helpers. Kept dependency-free so both server modules and tests can import it.
 */

/** Name of the HttpOnly cookie that carries the raw session token. */
export const SESSION_COOKIE_NAME = "hva_session";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a web session stays valid after login, in milliseconds (30 days). */
export const SESSION_DURATION_MS = 30 * DAY_MS;

/**
 * How long a device session (the Mac app) survives unused, in milliseconds (180
 * days, ADR 0013). Unlike a web session it is renewed whenever it is used, so
 * it lasts until the coach removes it or stops using the device.
 */
export const DEVICE_SESSION_IDLE_MS = 180 * DAY_MS;

/**
 * The least time between two writes of a session's `last_seen_at`, in
 * milliseconds (one hour). "Zuletzt verwendet" only needs that precision, and
 * the throttle keeps validation on a page render read-mostly.
 */
export const LAST_SEEN_INTERVAL_MS = 60 * 60 * 1000;

/** Path prefix of the route handlers, the only place a bearer token counts. */
export const API_PATH_PREFIX = "/api/";

/** Where an unauthenticated coach is sent to sign in. */
export const LOGIN_PATH = "/login";

/** Where a coach lands after a successful login or signup. */
export const DEFAULT_REDIRECT = "/";

/** Query key used to remember the page a coach was heading to before login. */
export const NEXT_PARAM = "next";
