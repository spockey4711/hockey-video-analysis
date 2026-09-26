"use client";

import { useActionState } from "react";

import { settingsContent } from "../content";

import { signOutDeviceAction } from "./actions";
import { deviceActionInitialState } from "./state";

import { Button } from "@/components/forms/Button";

const { devices } = settingsContent;

export interface SignOutDeviceFormProps {
  publicId: string;
  /** The device's name, so each row's button is told apart by screen readers. */
  name: string;
}

/**
 * "Abmelden" for one row of the Geräte list. A plain form posting to
 * `signOutDeviceAction`, so it works without JS; on this browser's own row it
 * signs out here and lands on the login page.
 */
export function SignOutDeviceForm({ publicId, name }: SignOutDeviceFormProps) {
  const [state, formAction, pending] = useActionState(
    signOutDeviceAction,
    deviceActionInitialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col items-start gap-[var(--space-1)] sm:items-end"
    >
      <input type="hidden" name="publicId" value={publicId} />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        iconLeft="log-out"
        disabled={pending}
        aria-label={devices.signOutNamed(name)}
      >
        {pending ? devices.signingOut : devices.signOut}
      </Button>
      {state.status === "error" && (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)] sm:text-right"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
