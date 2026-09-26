"use client";

import { useActionState, useState } from "react";

// Import the content module directly (not the feature barrel) so this client
// component never pulls the feature's `server-only` queries into the bundle.
import { tacticsContent } from "./content";
import { FORMATION_KINDS, type FormationKind } from "./formation";
import { createFormationAction } from "./formation-actions";
import { PITCH_VIEWS, type PitchView } from "./pitch";
import { sceneRedirectInitialState } from "./state";
import { MAX_SCENE_NAME_LENGTH } from "./validation";

import { Button } from "@/components/forms/Button";
import { ChoiceGroup } from "@/components/forms/ChoiceGroup";
import { Input } from "@/components/forms/Input";

const { formations, create, board } = tacticsContent;

/**
 * Create-formation form: a name, the view (fixed once it exists, like a
 * scene's) and whether it is for attack or defence. The coach lands on the
 * new formation's board to arrange the players.
 */
export function CreateFormationForm() {
  const [state, formAction, pending] = useActionState(
    createFormationAction,
    sceneRedirectInitialState,
  );
  const [view, setView] = useState<PitchView>("full");
  const [kind, setKind] = useState<FormationKind>("defence");

  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-3)]">
      <Input
        name="name"
        label={formations.label}
        placeholder={formations.placeholder}
        maxLength={MAX_SCENE_NAME_LENGTH}
        error={state.error}
        autoComplete="off"
        required
      />
      <div className="flex flex-wrap gap-[var(--space-4)]">
        <ChoiceGroup
          label={create.view}
          options={PITCH_VIEWS.map((value) => ({
            value,
            label: board.views[value],
          }))}
          value={view}
          onChange={setView}
        />
        <ChoiceGroup
          label={formations.kind}
          options={FORMATION_KINDS.map((value) => ({
            value,
            label: formations.kinds[value],
          }))}
          value={kind}
          onChange={setKind}
        />
      </div>
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="kind" value={kind} />
      <div>
        <Button type="submit" disabled={pending} iconLeft="plus">
          {formations.submit}
        </Button>
      </div>
    </form>
  );
}
