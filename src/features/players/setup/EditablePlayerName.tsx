"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { PlayerFields, type PlayerFieldValues } from "./PlayerFields";
import { updatePlayerAction } from "./actions";
import { playerSetupContent } from "./content";
import { playerFormInitialState, type PlayerFormState } from "./state";

import { Heading } from "@/components/core/Heading";
import { Button } from "@/components/forms/Button";
// Import the content module directly (not the feature barrel) so this client
// component never pulls the roster's `server-only` query into the client bundle.
import { rosterContent } from "@/features/players/roster/content";

/**
 * A roster row's name and jersey number with an inline edit control. The first
 * click on "Bearbeiten" swaps the heading for the edit form; saving updates the
 * player (never their share token, so the link keeps working), closes the form
 * and refreshes the roster.
 */
export function EditablePlayerName({
  playerId,
  name,
  jerseyNumber,
}: {
  playerId: string;
  name: string;
  jerseyNumber: number | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updatePlayerAction,
    playerFormInitialState,
  );
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<PlayerFieldValues>({
    name,
    jerseyNumber: "",
  });
  const [handled, setHandled] = useState(state);
  // The result shown in the open form; cleared on reopen so a cancelled edit's
  // errors never greet the next one.
  const [shown, setShown] = useState<PlayerFormState>(playerFormInitialState);

  // React to each new action result once: show it, and leave edit mode on a
  // successful save. Adjusting state during render (guarded on the state object
  // so it runs once) is React's recommended alternative to a state-setting effect.
  if (state !== handled) {
    setHandled(state);
    setShown(state);
    if (state.status === "success") setEditing(false);
  }

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  function startEditing() {
    // Seed from the current server values, so a reopened form never shows a
    // stale draft from an earlier, cancelled edit.
    setValues({
      name,
      jerseyNumber: jerseyNumber === null ? "" : String(jerseyNumber),
    });
    setShown(playerFormInitialState);
    setEditing(true);
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-[var(--space-3)]">
        <div className="flex min-w-0 items-baseline gap-[var(--space-2)]">
          <Heading level={2} size="sub" className="min-w-0 break-words">
            {name}
          </Heading>
          {jerseyNumber !== null && (
            <span className="shrink-0 text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
              {rosterContent.jerseyPrefix} {jerseyNumber}
            </span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          iconLeft="pencil"
          onClick={startEditing}
        >
          {playerSetupContent.editAction}
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-[var(--space-3)]"
      noValidate
    >
      <input type="hidden" name="playerId" value={playerId} />
      <PlayerFields
        values={values}
        onChange={setValues}
        fieldErrors={shown.fieldErrors}
      />
      {shown.status === "error" && shown.error && (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {shown.error}
        </p>
      )}
      <div className="flex flex-wrap gap-[var(--space-2)]">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? playerSetupContent.saving : playerSetupContent.saveAction}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setEditing(false)}
          disabled={pending}
        >
          {playerSetupContent.cancel}
        </Button>
      </div>
    </form>
  );
}
