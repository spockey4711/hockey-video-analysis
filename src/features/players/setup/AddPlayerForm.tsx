"use client";

import { useActionState, useState } from "react";

import { PlayerFields, type PlayerFieldValues } from "./PlayerFields";
import { createPlayerAction } from "./actions";
import { playerSetupContent } from "./content";
import { playerFormInitialState } from "./state";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";
import { Button } from "@/components/forms/Button";

const EMPTY: PlayerFieldValues = { name: "", jerseyNumber: "" };

/**
 * Coach control that adds a player to the roster. On success the fields clear
 * for the next entry and the roster is refreshed, so the new player's row - with
 * its secret share link - appears in the list below.
 */
export function AddPlayerForm() {
  const [state, formAction, pending] = useActionState(
    createPlayerAction,
    playerFormInitialState,
  );
  const [values, setValues] = useState<PlayerFieldValues>(EMPTY);
  const [handled, setHandled] = useState(state);

  // Clear the fields once per successful submit. Adjusting state during render
  // (guarded on the state object so it runs once) is React's recommended
  // alternative to a state-setting effect.
  if (state !== handled) {
    setHandled(state);
    if (state.status === "success") setValues(EMPTY);
  }

  return (
    <Card className="p-[var(--space-4)]">
      <form
        action={formAction}
        className="flex flex-col gap-[var(--space-4)]"
        noValidate
      >
        <PanelHeader
          size="sub"
          title={playerSetupContent.addHeading}
          hint={playerSetupContent.addHint}
        />

        <PlayerFields
          values={values}
          onChange={setValues}
          fieldErrors={state.fieldErrors}
        />

        {state.status === "error" && state.error && (
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
            {playerSetupContent.added}
          </p>
        )}

        <div>
          <Button type="submit" size="sm" iconLeft="plus" disabled={pending}>
            {pending ? playerSetupContent.adding : playerSetupContent.addAction}
          </Button>
        </div>
      </form>
    </Card>
  );
}
