"use server";

import { settingsContent } from "./content";
import { getCoachPasswordHash, updateCoachPassword } from "./queries";
import { validatePasswordChange, type PasswordField } from "./validation";

import {
  createSession,
  getCurrentCoach,
  hashPassword,
  invalidateAllSessions,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

const { errors } = settingsContent;

/** Shape returned to `useActionState`; the empty object is the initial state. */
export interface SettingsFormState {
  error?: string;
  fieldErrors?: Partial<Record<PasswordField, string>>;
  success?: boolean;
}

/**
 * Change the signed-in coach's password. Verifies the current password, applies
 * the shared strength rules, then re-hashes and rotates every session so other
 * devices are signed out - the current device is re-established with a fresh
 * session cookie so the coach stays logged in here.
 */
export async function changePasswordAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: errors.notSignedIn };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fieldErrors = validatePasswordChange({ current, next, confirm });
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const storedHash = await getCoachPasswordHash(coach.id);
  // The row is gone from under a live session: treat it as a lost session
  // rather than leaking that the account no longer exists.
  if (!storedHash) return { error: errors.notSignedIn };

  if (!(await verifyPassword(current, storedHash))) {
    return { fieldErrors: { current: errors.currentWrong } };
  }

  try {
    await updateCoachPassword(coach.id, await hashPassword(next));
    // Rotate all sessions (logs out other devices), then start a fresh one so
    // this device stays signed in with a cookie the old hash never issued.
    await invalidateAllSessions(coach.id);
    const { token, expiresAt } = await createSession(coach.id);
    await setSessionCookie(token, expiresAt);
  } catch {
    return { error: errors.unexpected };
  }

  return { success: true };
}
