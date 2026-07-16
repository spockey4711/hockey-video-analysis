/**
 * Pure input validation for the change-password form - no DB, no framework - so
 * it is unit-testable and shared by the server action and (implicitly) the UI.
 * The new-password strength rule is reused from the access feature so signup and
 * a later change enforce exactly the same minimum.
 */
import { settingsContent } from "./content";

import { validatePassword } from "@/features/access/validation";

const { errors } = settingsContent;

/** Field a change-password error may attach to, for inline display. */
export type PasswordField = "current" | "next" | "confirm";

/** Raw form values for a password change. */
export interface PasswordChangeInput {
  current: string;
  next: string;
  confirm: string;
}

/**
 * Validate a password change without touching the database (the current
 * password is only checked for presence here; whether it is *correct* is a DB
 * concern the action verifies). Returns a map of field errors, empty when valid.
 */
export function validatePasswordChange(
  input: PasswordChangeInput,
): Partial<Record<PasswordField, string>> {
  const fieldErrors: Partial<Record<PasswordField, string>> = {};

  if (!input.current) {
    fieldErrors.current = errors.currentRequired;
  }

  const nextError = validatePassword(input.next);
  if (nextError) {
    fieldErrors.next = nextError;
  } else if (input.next !== input.confirm) {
    fieldErrors.confirm = errors.confirmMismatch;
  } else if (input.current && input.next === input.current) {
    fieldErrors.next = errors.sameAsOld;
  }

  return fieldErrors;
}
