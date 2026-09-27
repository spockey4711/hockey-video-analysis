"use server";

import { settingsContent } from "./content";
import {
  getCoachPasswordHash,
  replacePasswordAndRevokeSessions,
} from "./queries";
import { validatePasswordChange, type PasswordField } from "./validation";

import {
  checkRateLimit,
  recordFailure,
  reset,
} from "@/features/access/rate-limit";
import { startWebSession } from "@/features/access/sign-in";
import { getCurrentCoach, hashPassword, verifyPassword } from "@/lib/auth";

const { errors } = settingsContent;

/** Shape returned to `useActionState`; the empty object is the initial state. */
export interface SettingsFormState {
  error?: string;
  fieldErrors?: Partial<Record<PasswordField, string>>;
  success?: boolean;
}

/**
 * Rate-limit key for current-password guesses. Keyed by coach, not IP: the
 * caller already holds a session, so what needs protecting is that account's
 * password against someone who picked up a signed-in device.
 */
function rateLimitKey(coachId: string): string {
  return `change-password:${coachId}`;
}

/**
 * Change the signed-in coach's password. Verifies the current password (rate
 * limited like login), applies the shared strength rules, then re-hashes and
 * revokes every session in one transaction so all devices are signed out, the
 * Mac app included - this browser is re-established with a fresh session
 * cookie so the coach stays signed in here.
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

  const key = rateLimitKey(coach.id);
  if (checkRateLimit(key).limited) {
    return { error: errors.tooManyAttempts };
  }

  const storedHash = await getCoachPasswordHash(coach.id);
  // The row is gone from under a live session: treat it as a lost session
  // rather than leaking that the account no longer exists.
  if (!storedHash) return { error: errors.notSignedIn };

  if (!(await verifyPassword(current, storedHash))) {
    recordFailure(key);
    return { fieldErrors: { current: errors.currentWrong } };
  }
  reset(key);

  try {
    await replacePasswordAndRevokeSessions(coach.id, await hashPassword(next));
  } catch (cause) {
    console.error("failed to change password", cause);
    return { error: errors.unexpected };
  }

  try {
    // Every session is gone now, this device's included; start a fresh one so
    // the coach stays signed in here with a cookie the old password never saw.
    await startWebSession(coach.id);
  } catch (cause) {
    // The password did change; only this device lost its session. Say so
    // rather than report a failure the coach would retry with the old password.
    console.error("failed to start a session after a password change", cause);
    return { error: errors.changedButSignedOut };
  }

  return { success: true };
}
