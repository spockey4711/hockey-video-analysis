"use client";

import { useActionState, useState } from "react";

import { createSceneAction } from "./actions";
// Import the content module directly (not the feature barrel) so this client
// component never pulls the feature's `server-only` queries into the bundle.
import { tacticsContent } from "./content";
import { PITCH_VIEWS, type PitchView } from "./pitch";
import { sceneRedirectInitialState } from "./state";
import { MAX_SCENE_NAME_LENGTH } from "./validation";

import { Button } from "@/components/forms/Button";
import { ChoiceGroup } from "@/components/forms/ChoiceGroup";
import { Input } from "@/components/forms/Input";

const { create, board } = tacticsContent;

/**
 * Create-scene form: a name and how much of the pitch the scene shows, the
 * whole field (the default) or the short corner. The view is fixed once the
 * scene exists. The coach lands on the new scene's board.
 */
export function CreateSceneForm() {
  const [state, formAction, pending] = useActionState(
    createSceneAction,
    sceneRedirectInitialState,
  );
  const [view, setView] = useState<PitchView>("full");

  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-3)]">
      <Input
        name="name"
        label={create.label}
        placeholder={create.placeholder}
        maxLength={MAX_SCENE_NAME_LENGTH}
        error={state.error}
        autoComplete="off"
        required
      />
      <div className="flex flex-col gap-[var(--space-1)]">
        <ChoiceGroup
          label={create.view}
          options={PITCH_VIEWS.map((value) => ({
            value,
            label: board.views[value],
          }))}
          value={view}
          onChange={setView}
        />
        <input type="hidden" name="view" value={view} />
        <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
          {create.viewHint}
        </p>
      </div>
      <div>
        <Button type="submit" disabled={pending} iconLeft="plus">
          {create.submit}
        </Button>
      </div>
    </form>
  );
}
