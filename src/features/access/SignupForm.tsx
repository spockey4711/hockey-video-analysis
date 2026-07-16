"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signupAction, type AccessFormState } from "./actions";
import { accessContent } from "./content";

import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";

const { signup } = accessContent;
const initialState: AccessFormState = {};

/** Coach registration form, gated by an invite code and carrying `next` through. */
export function SignupForm({
  next,
  loginHref,
}: {
  next?: string;
  loginHref?: string;
}) {
  const [state, formAction, pending] = useActionState(
    signupAction,
    initialState,
  );
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form
      action={formAction}
      className="flex flex-col gap-[var(--space-4)]"
      noValidate
    >
      {next && <input type="hidden" name="next" value={next} />}

      {state.error && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[color:var(--danger)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}

      <Input
        name="name"
        label={signup.nameLabel}
        autoComplete="name"
        error={fieldErrors.name}
        required
      />
      <Input
        name="email"
        type="email"
        label={signup.emailLabel}
        autoComplete="email"
        error={fieldErrors.email}
        required
      />
      <Input
        name="password"
        type="password"
        label={signup.passwordLabel}
        autoComplete="new-password"
        hint={signup.passwordHint}
        error={fieldErrors.password}
        required
      />
      <Input
        name="code"
        label={signup.inviteLabel}
        autoComplete="off"
        error={fieldErrors.code}
        required
      />

      <Button type="submit" full disabled={pending}>
        {pending ? signup.submitting : signup.submit}
      </Button>

      {loginHref && (
        <p className="text-center text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {signup.loginPrompt}{" "}
          <Link
            href={loginHref}
            className="text-[color:var(--accent)] underline-offset-2 hover:underline"
          >
            {signup.loginLink}
          </Link>
        </p>
      )}
    </form>
  );
}
