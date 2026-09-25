"use client";

import { useActionState } from "react";

import { createSceneAction } from "./actions";
// Import the content module directly (not the feature barrel) so this client
// component never pulls the feature's `server-only` queries into the bundle.
import { tacticsContent } from "./content";
import { sceneRedirectInitialState } from "./state";
import { MAX_SCENE_NAME_LENGTH } from "./validation";

import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";

const { create } = tacticsContent;

/**
 * Create-scene form: just a name. The new scene starts with eleven a side and
 * the ball on the centre spot, and the coach lands on its board.
 */
export function CreateSceneForm() {
  const [state, formAction, pending] = useActionState(
    createSceneAction,
    sceneRedirectInitialState,
  );

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
      <div>
        <Button type="submit" disabled={pending} iconLeft="plus">
          {create.submit}
        </Button>
      </div>
    </form>
  );
}
