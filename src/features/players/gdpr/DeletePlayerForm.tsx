"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { deletePlayerAction } from "./actions";
import { gdprContent } from "./content";
import { deletePlayerInitialState } from "./state";

import { Button } from "@/components/forms/Button";

/**
 * Coach control that erases a player and their personal data (GDPR). Deletion is
 * irreversible and takes the player's own clips with them, so the trigger is
 * confirm-gated: the first click reveals a warning and the real danger button
 * (`confirmYes`) rather than firing immediately. On success the roster is
 * refreshed, which removes this row.
 */
export function DeletePlayerForm({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    deletePlayerAction,
    deletePlayerInitialState,
  );
  const [confirming, setConfirming] = useState(false);

  // On success the player is gone; refresh the roster so the row disappears.
  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  // Leave the confirm step once the deletion succeeds. Adjusting state during
  // render (guarded so it runs once) is React's recommended alternative to a
  // state-setting effect.
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

      {confirming ? (
        <div className="flex flex-col gap-[var(--space-2)]">
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
            {gdprContent.confirm}
          </p>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Button type="submit" size="sm" variant="danger" disabled={pending}>
              {pending ? gdprContent.running : gdprContent.confirmYes}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              {gdprContent.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(true)}
          className="text-[color:var(--danger)]"
        >
          {gdprContent.action}
        </Button>
      )}
    </form>
  );
}
