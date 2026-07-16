"use client";

import { useFormStatus } from "react-dom";

import { logoutAction } from "./actions";
import { accessContent } from "./content";

import { Button } from "@/components/forms/Button";

const { shell } = accessContent;

/**
 * Submit button for the sign-out form. Split out so it can read the parent
 * form's pending state via `useFormStatus` and disable itself while the
 * `logoutAction` server action runs.
 */
function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      iconLeft="log-out"
      disabled={pending}
    >
      {pending ? shell.signingOut : shell.signOut}
    </Button>
  );
}

/**
 * Logout control for the coach app shell. Posts to the `logoutAction` server
 * action, which invalidates the session, clears the cookie and redirects to the
 * login page. A plain form keeps sign-out a real POST that works without JS.
 */
export function SignOutForm() {
  return (
    <form action={logoutAction}>
      <SignOutButton />
    </form>
  );
}
