"use client";

import { useActionState } from "react";

import { changePasswordAction, type SettingsFormState } from "./actions";
import { settingsContent } from "./content";

import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";
import { PASSWORD_MIN_LENGTH } from "@/features/access/validation";

const { password } = settingsContent;
const initialState: SettingsFormState = {};

/**
 * Coach password-change form. Posts to the `changePasswordAction` server action
 * and surfaces its field-level and form-level errors inline; on success React 19
 * resets the uncontrolled fields, so the entered passwords do not linger.
 */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-4)]">
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

      <Button type="submit" disabled={pending}>
        {pending ? password.submitting : password.submit}
      </Button>
    </form>
  );
}
