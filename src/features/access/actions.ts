"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { accessContent } from "./content";
import { isSignupEnabled, verifyInviteCode } from "./invite";
import { createCoach, findCoachByEmail } from "./queries";
import { checkRateLimit, recordFailure, reset } from "./rate-limit";
import {
  normalizeEmail,
  sanitizeNext,
  validateEmail,
  validateName,
  validatePassword,
} from "./validation";

import {
  DEFAULT_REDIRECT,
  LOGIN_PATH,
  createSession,
  getSessionCookie,
  hashPassword,
  invalidateSession,
  setSessionCookie,
  clearSessionCookie,
  verifyPassword,
} from "@/lib/auth";

const { errors } = accessContent;

/** Field a form-level error may attach to, for inline display. */
type FieldName = "email" | "password" | "name" | "code";

/** Shape returned to `useActionState`; the empty object is the initial state. */
export interface AccessFormState {
  error?: string;
  fieldErrors?: Partial<Record<FieldName, string>>;
}

/** Postgres unique-violation code, thrown when two signups race on one email. */
const PG_UNIQUE_VIOLATION = "23505";

async function clientKey(email: string): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${ip}:${email}`;
}

/** Authenticate a coach and start a session, then redirect to `next`. */
export async function loginAction(
  _prev: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNext(
    formData.get("next") as string | null,
    DEFAULT_REDIRECT,
  );

  // Login errors stay generic (no account enumeration) but presence is checked
  // so an empty submit gives a helpful message rather than a failed lookup.
  if (!email || !password) {
    return { error: errors.invalidCredentials };
  }

  const key = await clientKey(email);
  if (checkRateLimit(key).limited) {
    return { error: errors.tooManyAttempts };
  }

  const coach = await findCoachByEmail(email);
  // Verify against a real hash even when the account is missing, so the response
  // time does not reveal whether the email exists (no user enumeration).
  const ok = coach
    ? await verifyPassword(password, coach.passwordHash)
    : await verifyPassword(password, await dummyHash());

  if (!coach || !ok) {
    recordFailure(key);
    return { error: errors.invalidCredentials };
  }

  reset(key);
  const { token, expiresAt } = await createSession(coach.id);
  await setSessionCookie(token, expiresAt);
  redirect(next);
}

/** Register a coach behind the invite code, start a session, then redirect. */
export async function signupAction(
  _prev: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  if (!isSignupEnabled()) {
    return { error: accessContent.signup.disabledBody };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "");
  const next = sanitizeNext(
    formData.get("next") as string | null,
    DEFAULT_REDIRECT,
  );

  const fieldErrors: Partial<Record<FieldName, string>> = {};
  const nameError = validateName(name);
  if (nameError) fieldErrors.name = nameError;
  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;
  const passwordError = validatePassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  if (!code) fieldErrors.code = errors.inviteRequired;

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  if (!verifyInviteCode(code)) {
    return { fieldErrors: { code: errors.inviteInvalid } };
  }

  const passwordHash = await hashPassword(password);
  let coachId: string;
  try {
    const created = await createCoach({ email, name, passwordHash });
    coachId = created.id;
  } catch (cause) {
    if (isUniqueViolation(cause)) {
      return { fieldErrors: { email: errors.emailTaken } };
    }
    return { error: errors.unexpected };
  }

  const { token, expiresAt } = await createSession(coachId);
  await setSessionCookie(token, expiresAt);
  redirect(next);
}

/** End the current session and return to the login page. */
export async function logoutAction(): Promise<void> {
  const token = await getSessionCookie();
  if (token) await invalidateSession(token);
  await clearSessionCookie();
  redirect(LOGIN_PATH);
}

function isUniqueViolation(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

// A real scrypt hash of a random secret, computed once and reused only to
// equalize login timing when the account is missing. It never matches input.
let dummyHashCache: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashCache ??= hashPassword(crypto.randomUUID());
  return dummyHashCache;
}
