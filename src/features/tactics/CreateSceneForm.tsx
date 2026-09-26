"use client";

import { useActionState, useState } from "react";

import { createSceneAction } from "./actions";
// Import the content module directly (not the feature barrel) so this client
// component never pulls the feature's `server-only` queries into the bundle.
import { tacticsContent } from "./content";
import { BUILT_IN_STARTS } from "./formation";
import type { FormationListItem } from "./formation-queries";
import { PITCH_VIEWS, type PitchView } from "./pitch";
import { sceneRedirectInitialState } from "./state";
import { MAX_SCENE_NAME_LENGTH } from "./validation";

import { Button } from "@/components/forms/Button";
import { ChoiceGroup } from "@/components/forms/ChoiceGroup";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";

const { create, board, formations: formationCopy } = tacticsContent;

/**
 * Create-scene form: a name, how much of the pitch the scene shows (the whole
 * field by default, or the short corner) and what it starts from: a built-in
 * start of that view or a copy of one of the coach's formations for it. The
 * view is fixed once the scene exists. The coach lands on the new scene's
 * board.
 */
export function CreateSceneForm({
  formations,
}: {
  formations: readonly FormationListItem[];
}) {
  const [state, formAction, pending] = useActionState(
    createSceneAction,
    sceneRedirectInitialState,
  );
  const [view, setView] = useState<PitchView>("full");
  const [start, setStart] = useState<string>(BUILT_IN_STARTS.full[0]);
  const starts = [
    ...BUILT_IN_STARTS[view].map((value) => ({
      value,
      label: create.starts[value],
    })),
    ...formations
      .filter((formation) => formation.view === view)
      .map((formation) => ({
        value: formation.id,
        label: create.formation(
          formation.name,
          formationCopy.kinds[formation.kind],
        ),
      })),
  ];
  const fromFormation = !BUILT_IN_STARTS[view].some((value) => value === start);

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
          onChange={(next) => {
            setView(next);
            setStart(BUILT_IN_STARTS[next][0]);
          }}
        />
        <input type="hidden" name="view" value={view} />
        <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
          {create.viewHint}
        </p>
      </div>
      <div className="flex flex-col gap-[var(--space-1)]">
        <Select
          name="start"
          label={create.start}
          options={starts}
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
        {fromFormation && (
          <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
            {create.startHint}
          </p>
        )}
      </div>
      <div>
        <Button type="submit" disabled={pending} iconLeft="plus">
          {create.submit}
        </Button>
      </div>
    </form>
  );
}
