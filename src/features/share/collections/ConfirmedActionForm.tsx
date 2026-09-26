"use client";

import { useActionState, useState } from "react";

import { collectionsContent } from "./content";
import {
  type CollectionMutationState,
  collectionMutationInitialState,
} from "./state";

import type { IconName } from "@/components/core/Icon";
import { Button, type ButtonVariant } from "@/components/forms/Button";

const { detail } = collectionsContent.coach;

export interface ConfirmedActionFormProps {
  readonly collectionId: string;
  /** The server action the confirm button submits. */
  readonly action: (
    prev: CollectionMutationState,
    formData: FormData,
  ) => Promise<CollectionMutationState>;
  /** Copy for the trigger, the confirm step and the outcome. */
  readonly copy: {
    readonly submit: string;
    readonly confirm: string;
    readonly confirmYes: string;
    readonly running: string;
    readonly success?: string;
  };
  readonly icon: IconName;
  /** Optional muted line under the trigger; the confirm step replaces it. */
  readonly hint?: string;
  /** Variant of the button that commits the action. */
  readonly confirmVariant: ButtonVariant;
}

/**
 * A collection control that destroys something (the current link, or the whole
 * collection), so it is confirm-gated: the first click only reveals a warning
 * with the real submit button and a cancel, never firing the action directly.
 * The step closes again once the action succeeds, so the coach sees the result
 * rather than the warning.
 */
export function ConfirmedActionForm({
  collectionId,
  action,
  copy,
  icon,
  hint,
  confirmVariant,
}: ConfirmedActionFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    collectionMutationInitialState,
  );
  const [confirming, setConfirming] = useState(false);
  const [settled, setSettled] = useState(state);

  // Close the step when a new result arrives. Keyed on the result object, not
  // its status, so a later click can reopen the step after a success. Adjusting
  // state during render is React's recommended alternative to a state-setting
  // effect.
  if (state !== settled) {
    setSettled(state);
    if (state.status === "success") setConfirming(false);
  }

  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-2)]">
      <input type="hidden" name="collectionId" value={collectionId} />

      {state.status === "error" && state.error && (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}
      {state.status === "success" && copy.success && !confirming && (
        <p
          role="status"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]"
        >
          {copy.success}
        </p>
      )}

      {confirming ? (
        <div className="flex flex-col gap-[var(--space-2)]">
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
            {copy.confirm}
          </p>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Button
              type="submit"
              size="sm"
              variant={confirmVariant}
              iconLeft={icon}
              disabled={pending}
            >
              {pending ? copy.running : copy.confirmYes}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              {detail.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            iconLeft={icon}
            onClick={() => setConfirming(true)}
          >
            {copy.submit}
          </Button>
          {hint && (
            <p className="mt-[var(--space-2)] text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
              {hint}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
