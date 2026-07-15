/**
 * Public surface of the auth library. Feature code should import from here
 * rather than reaching into individual modules.
 */
export {
  DEFAULT_REDIRECT,
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
  validateSessionToken,
  type ActiveSession,
  type SessionCoach,
} from "./session";
export { getCurrentCoach } from "./current-coach";
