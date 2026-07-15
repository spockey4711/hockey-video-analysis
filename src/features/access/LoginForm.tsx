"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type AccessFormState } from "./actions";
import { accessContent } from "./content";

import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";

const { login } = accessContent;
const initialState: AccessFormState = {};

/** Coach sign-in form. `next` is carried through so login returns to the target page. */
export function LoginForm({
  next,
  signupHref,
}: {
  next?: string;
  signupHref?: string;
}) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

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
        name="email"
        type="email"
        label={login.emailLabel}
        autoComplete="email"
        required
      />
      <Input
        name="password"
        type="password"
        label={login.passwordLabel}
        autoComplete="current-password"
        required
      />

      <Button type="submit" full disabled={pending}>
        {pending ? login.submitting : login.submit}
      </Button>

      {signupHref && (
        <p className="text-center text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {login.signupPrompt}{" "}
          <Link
            href={signupHref}
            className="text-[color:var(--accent)] underline-offset-2 hover:underline"
          >
            {login.signupLink}
          </Link>
        </p>
      )}
    </form>
  );
}
