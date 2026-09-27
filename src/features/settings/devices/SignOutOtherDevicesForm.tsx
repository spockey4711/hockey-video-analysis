"use client";

import { useActionState, useState } from "react";

import { settingsContent } from "../content";

import { signOutOtherDevicesAction } from "./actions";
import { deviceActionInitialState } from "./state";

import { Button } from "@/components/forms/Button";

const { others } = settingsContent.devices;

/**
 * "Alle anderen abmelden": signs out every browser and the Mac app but this
 * one. It reaches devices the coach may not have at hand, so the trigger is
 * confirm-gated: the first click reveals a warning and the real submit button.
 */
export function SignOutOtherDevicesForm() {
  const [state, formAction, pending] = useActionState(
    signOutOtherDevicesAction,
    deviceActionInitialState,
  );
  const [confirming, setConfirming] = useState(false);
  const [settled, setSettled] = useState(state);

  // Leave the confirm step once the action answers, so the coach sees the
  // result rather than the warning. Adjusting state during render is React's
  // recommended alternative to a state-setting effect.
  if (state !== settled) {
    setSettled(state);
    setConfirming(false);
  }

  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-2)]">
      {state.status === "error" && (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}

      {confirming ? (
        <div className="flex flex-col gap-[var(--space-2)]">
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
            {others.confirm}
          </p>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Button type="submit" size="sm" variant="danger" disabled={pending}>
              {pending ? others.running : others.confirmYes}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              {others.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            iconLeft="log-out"
            onClick={() => setConfirming(true)}
          >
            {others.action}
          </Button>
        </div>
      )}
    </form>
  );
}
