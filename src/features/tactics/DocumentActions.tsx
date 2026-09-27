"use client";

/**
 * Duplicate or delete a stored board document, a scene or a formation. Both
 * act on what is stored, so unsaved edits stay with the editor.
 */
import { useActionState, useState } from "react";

import { tacticsContent } from "./content";
import {
  sceneMutationInitialState,
  sceneRedirectInitialState,
  type SceneMutationState,
  type SceneRedirectState,
} from "./state";

import { Button } from "@/components/forms/Button";

const { editor } = tacticsContent;

export interface DocumentActionsProps {
  /** The form field the id is sent in. */
  readonly idField: string;
  readonly id: string;
  readonly duplicateAction: (
    prev: SceneRedirectState,
    formData: FormData,
  ) => Promise<SceneRedirectState>;
  readonly deleteAction: (
    prev: SceneMutationState,
    formData: FormData,
  ) => Promise<SceneMutationState>;
  /** The question asked before deleting. */
  readonly confirmDelete: string;
}

/** Duplicate the stored scene or formation, or delete it after a confirm step. */
export function DocumentActions({
  idField,
  id,
  duplicateAction: duplicate,
  deleteAction: remove,
  confirmDelete,
}: DocumentActionsProps) {
  const [duplicateState, duplicateAction, duplicating] = useActionState(
    duplicate,
    sceneRedirectInitialState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    remove,
    sceneMutationInitialState,
  );
  const [confirming, setConfirming] = useState(false);
  const error = duplicateState.error ?? deleteState.error;

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      {error && (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <form action={duplicateAction}>
          <input type="hidden" name={idField} value={id} />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={duplicating}
          >
            {editor.duplicate}
          </Button>
        </form>
        <form
          action={deleteAction}
          className="flex flex-wrap items-center gap-[var(--space-2)]"
        >
          <input type="hidden" name={idField} value={id} />
          {confirming ? (
            <>
              <span className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
                {confirmDelete}
              </span>
              <Button
                type="submit"
                size="sm"
                variant="danger"
                disabled={deleting}
              >
                {editor.confirmYes}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirming(false)}
              >
                {editor.cancel}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              iconLeft="trash-2"
              className="text-[color:var(--danger)]"
              onClick={() => setConfirming(true)}
            >
              {editor.delete}
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
