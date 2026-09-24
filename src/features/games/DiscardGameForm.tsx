"use client";

import { useActionState, useState } from "react";

import { discardImportedGameAction, type DiscardGameState } from "./actions";
import { gamesContent } from "./content";

import { Button } from "@/components/forms/Button";

const { review } = gamesContent;
const initialState: DiscardGameState = {};

/**
 * Discard an imported game from the review. Deleting is not undoable, so the
 * trigger is confirm-gated like the share-token rotation: the first click
 * reveals what gets deleted and the real submit button, not the deletion.
 */
export function DiscardGameForm({ gameId }: { gameId: string }) {
  const [state, formAction, pending] = useActionState(
    discardImportedGameAction,
    initialState,
  );
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-2)]">
      <input type="hidden" name="gameId" value={gameId} />

      {state.error && (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}

      {confirming ? (
        <div className="flex flex-col gap-[var(--space-2)]">
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
            {review.discardConfirm}
          </p>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Button type="submit" size="sm" variant="danger" disabled={pending}>
              {pending ? review.discarding : review.discardYes}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              {review.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="self-start"
          onClick={() => setConfirming(true)}
        >
          {review.discard}
        </Button>
      )}
    </form>
  );
}
