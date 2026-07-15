"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { rotateShareTokenAction } from "./actions";
import { rotationContent } from "./content";
import { rotateShareTokenInitialState } from "./state";

import { Button } from "@/components/forms/Button";

/**
 * Coach control that rotates one player's share token, revoking the current
 * secret link. The action is destructive to the old link, so the trigger is
 * confirm-gated: the first click reveals a warning and the real submit button
 * (`confirmYes`) rather than firing immediately. On success the parent server
 * data is refreshed so the row shows the fresh link.
 */
export function RotateShareTokenForm({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    rotateShareTokenAction,
    rotateShareTokenInitialState,
  );
  const [confirming, setConfirming] = useState(false);

  // On a successful rotation the row's share link changed; refresh the server
  // component so it reflects the new token.
  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  // Leave the confirm step once the rotation succeeds so the coach sees the
  // result, not the warning. Adjusting state during render (guarded so it runs
  // once) is React's recommended alternative to a state-setting effect.
  if (state.status === "success" && confirming) {
    setConfirming(false);
  }

  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-2)]">
      <input type="hidden" name="playerId" value={playerId} />

      {state.status === "error" && (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}
      {state.status === "success" && (
        <p
          role="status"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]"
        >
          {rotationContent.success}
        </p>
      )}

      {confirming ? (
        <div className="flex flex-col gap-[var(--space-2)]">
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
            {rotationContent.confirm}
          </p>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? rotationContent.running : rotationContent.confirmYes}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              {rotationContent.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          iconLeft="link"
          onClick={() => setConfirming(true)}
        >
          {rotationContent.action}
        </Button>
      )}
    </form>
  );
}
