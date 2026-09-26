"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { accessContent } from "./content";
import { isSignupEnabled, verifyInviteCode } from "./invite";
import { createCoach } from "./queries";
import { checkCredentials, clientIp, startWebSession } from "./sign-in";
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
  getSessionCookie,
  hashPassword,
  invalidateSession,
  clearSessionCookie,
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

  const check = await checkCredentials(
    email,
    password,
    clientIp(await headers()),
  );
  if (!check.ok) {
    return {
      error:
        check.reason === "limited"
          ? errors.tooManyAttempts
          : errors.invalidCredentials,
    };
  }

  await startWebSession(check.coachId);
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

  await startWebSession(coachId);
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
