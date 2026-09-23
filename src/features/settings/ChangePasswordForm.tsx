"use client";

import { useActionState } from "react";

import { changePasswordAction, type SettingsFormState } from "./actions";
import { settingsContent } from "./content";

import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";
import { PASSWORD_MIN_LENGTH } from "@/features/access/validation";

const { password } = settingsContent;
const initialState: SettingsFormState = {};

export interface ChangePasswordFormProps {
  /** Signed-in coach's email, so password managers know which login to update. */
  email: string;
}

/**
 * Coach password-change form. Posts to the `changePasswordAction` server action
 * and surfaces its field-level and form-level errors inline; after each submit
 * React 19 resets the uncontrolled fields, so entered passwords never linger.
 * Native validation is off so every message renders in the app's own inline
 * style, as on the login form; the server action is the real check.
 */
export function ChangePasswordForm({ email }: ChangePasswordFormProps) {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-[var(--space-4)]"
      noValidate
    >
      {/* Hidden username so password managers file the new password under the
          right account. */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />

      {state.error && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[color:var(--danger)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}

      {state.success && (
        <p
          role="status"
          className="rounded-[var(--radius-md)] border border-[color:var(--accent)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]"
        >
          {password.success}
        </p>
      )}

      <Input
        name="current"
        type="password"
        label={password.currentLabel}
        autoComplete="current-password"
        error={state.fieldErrors?.current}
        required
      />
      <Input
        name="next"
        type="password"
        label={password.newLabel}
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        hint={password.newHint}
        error={state.fieldErrors?.next}
        required
      />
      <Input
        name="confirm"
        type="password"
        label={password.confirmLabel}
        autoComplete="new-password"
        error={state.fieldErrors?.confirm}
        required
      />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? password.submitting : password.submit}
        </Button>
      </div>
    </form>
  );
}
