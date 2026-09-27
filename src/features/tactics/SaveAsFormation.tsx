"use client";

/**
 * Save the scene's start arrangement as a new formation, from the scene
 * editor: a button that opens a name and attack-or-defence form. It sends the
 * board as it is, saved or not, and the coach stays on the scene.
 */
import Link from "next/link";
import { useActionState, useState } from "react";

import { tacticsContent } from "./content";
import { FORMATION_KINDS, type FormationKind } from "./formation";
import { saveSceneAsFormationAction } from "./formation-actions";
import {
  formationFromSceneInitialState,
  type FormationFromSceneState,
} from "./state";
import { MAX_SCENE_NAME_LENGTH } from "./validation";

import { Button } from "@/components/forms/Button";
import { ChoiceGroup } from "@/components/forms/ChoiceGroup";
import { Input } from "@/components/forms/Input";

const { formations, editor } = tacticsContent;
const { fromScene } = formations;

export function SaveAsFormation({ sceneJson }: { sceneJson: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FormationKind>("defence");
  // A saved formation closes the form and leaves a link to it behind.
  const [state, formAction, pending] = useActionState(
    async (previous: FormationFromSceneState, formData: FormData) => {
      const result = await saveSceneAsFormationAction(previous, formData);
      if (result.status === "success") setOpen(false);
      return result;
    },
    formationFromSceneInitialState,
  );

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-[var(--space-3)]">
        <Button
          size="sm"
          variant="secondary"
          iconLeft="users"
          onClick={() => setOpen(true)}
        >
          {fromScene.open}
        </Button>
        {state.status === "success" && state.formationId && (
          <p
            role="status"
            className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]"
          >
            {fromScene.saved}{" "}
            <Link
              href={`/tactics/formations/${state.formationId}`}
              className="text-[color:var(--text-primary)] underline underline-offset-2"
            >
              {fromScene.show}
            </Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-3)]">
      <input type="hidden" name="scene" value={sceneJson} />
      <input type="hidden" name="kind" value={kind} />
      <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
        {fromScene.hint}
      </p>
      <div className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <Input
            name="name"
            label={formations.label}
            placeholder={formations.placeholder}
            maxLength={MAX_SCENE_NAME_LENGTH}
            error={state.status === "error" ? state.error : undefined}
            autoComplete="off"
            required
          />
        </div>
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
      <div className="flex flex-wrap gap-[var(--space-2)]">
        <Button type="submit" size="sm" disabled={pending} iconLeft="check">
          {fromScene.submit}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          {editor.cancel}
        </Button>
      </div>
    </form>
  );
}
