/**
 * Public surface of the auth library. Feature code should import from here
 * rather than reaching into individual modules.
 */
export {
  API_PATH_PREFIX,
  DEFAULT_REDIRECT,
  DEVICE_SESSION_IDLE_MS,
  LAST_SEEN_INTERVAL_MS,
  LOGIN_PATH,
  NEXT_PARAM,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "./config";
export { hashPassword, verifyPassword } from "./password";
export { generateSessionToken, hashSessionToken } from "./tokens";
export {
  clearSessionCookie,
  getSessionCookie,
  setSessionCookie,
} from "./cookies";
export {
  createSession,
  deleteExpiredSessions,
  invalidateAllSessions,
  invalidateSession,
  isSessionExpired,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  sessionExpiresAt,
  shouldRecordUse,
  validateSessionToken,
  type ActiveSession,
  type NewSession,
  type SessionCoach,
  type SessionKind,
  type SessionSummary,
} from "./session";
export { getCurrentCoach, getCurrentSession } from "./current-coach";
export { getApiSession, isApiPath, readBearerToken } from "./api-session";
