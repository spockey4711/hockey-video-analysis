"use client";

import { useFormStatus } from "react-dom";

import { logoutAction } from "./actions";
import { accessContent } from "./content";

import { Button, type ButtonVariant } from "@/components/forms/Button";

const { shell } = accessContent;

export interface SignOutFormProps {
  /**
   * Button style: the quiet `ghost` default suits the header; a panel such as
   * the settings page uses `secondary` so the control sits flush with its text.
   */
  variant?: Extract<ButtonVariant, "ghost" | "secondary">;
  /**
   * Show only the icon below the `sm` breakpoint so a narrow top bar keeps room
   * for the brand; the label stays in the accessible name at every width.
   */
  compact?: boolean;
}

/**
 * Submit button for the sign-out form. Split out so it can read the parent
 * form's pending state via `useFormStatus` and disable itself while the
 * `logoutAction` server action runs.
 */
function SignOutButton({ variant, compact }: Required<SignOutFormProps>) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size="sm"
      iconLeft="log-out"
      disabled={pending}
    >
      <span className={compact ? "max-sm:sr-only" : undefined}>
        {pending ? shell.signingOut : shell.signOut}
      </span>
    </Button>
  );
}

/**
 * Logout control for the coach app shell. Posts to the `logoutAction` server
 * action, which invalidates the session, clears the cookie and redirects to the
 * login page. A plain form keeps sign-out a real POST that works without JS.
 */
export function SignOutForm({
  variant = "ghost",
  compact = false,
}: SignOutFormProps) {
  return (
    <form action={logoutAction}>
      <SignOutButton variant={variant} compact={compact} />
    </form>
  );
}
