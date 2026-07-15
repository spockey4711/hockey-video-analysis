/**
 * Pure input validation for the access forms - no DB, no framework - so it is
 * unit-testable and shared by the server actions and (implicitly) the UI. The
 * boundary is where we validate: server actions call these before touching the
 * database.
 */
import { accessContent } from "./content";

const { errors } = accessContent;

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 200;
const NAME_MAX_LENGTH = 100;

// Deliberately permissive: enough structure to catch typos without rejecting
// valid but unusual addresses. Real deliverability is proven by a login later.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim and lowercase an email for storage and lookup, so case never splits accounts. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Validate an email's shape. Returns an error message key or `null` when valid. */
export function validateEmail(raw: string): string | null {
  const email = raw.trim();
  if (!email) return errors.emailRequired;
  if (email.length > 320 || !EMAIL_PATTERN.test(email))
    return errors.emailInvalid;
  return null;
}

/** Validate a new-account password. Returns an error message or `null`. */
export function validatePassword(raw: string): string | null {
  if (!raw) return errors.passwordRequired;
  if (raw.length < PASSWORD_MIN_LENGTH) return errors.passwordTooShort;
  if (raw.length > PASSWORD_MAX_LENGTH) return errors.passwordTooShort;
  return null;
}

/** Validate a coach display name. Returns an error message or `null`. */
export function validateName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return errors.nameRequired;
  if (name.length > NAME_MAX_LENGTH) return errors.nameRequired;
  return null;
}

/**
 * Confine a post-login redirect target to a same-origin path so `next` cannot be
 * turned into an open redirect. Anything that is not a single-slash-prefixed
 * local path falls back to the default.
 */
export function sanitizeNext(
  raw: string | null | undefined,
  fallback: string,
): string {
  if (!raw) return fallback;
  // Must be a root-relative path; reject protocol-relative ("//host") and any
  // scheme or backslash trickery.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }
  return raw;
}
