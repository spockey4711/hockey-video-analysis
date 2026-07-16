"use client";

import { useActionState } from "react";

import { createCollectionAction } from "./actions";
// Import the content module directly (not the feature barrel) so this client
// component never pulls the feature's `server-only` queries into the bundle.
import { collectionsContent } from "./content";
import { createCollectionInitialState } from "./state";

import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";

const { create } = collectionsContent.coach;

/**
 * Create-collection form: just a name. A successful create redirects to the new
 * collection's detail page, where the coach picks its clips, so there is nothing
 * to keep on this form beyond a validation error.
 */
export function CreateCollectionForm() {
  const [state, formAction, pending] = useActionState(
    createCollectionAction,
    createCollectionInitialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-3)]">
      <Input
        name="name"
        label={create.label}
        placeholder={create.placeholder}
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
