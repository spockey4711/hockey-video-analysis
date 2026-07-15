"use client";

import Link from "next/link";
import { useActionState } from "react";

import { renameGameAction, type RenameGameState } from "./actions";
import { gamesContent } from "./content";

import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";

const { rename } = gamesContent;
const initialState: RenameGameState = {};

/**
 * Give an auto-ingested (or any) game a title. The game id rides in a hidden
 * field so the server action knows which row to update; the current title
 * pre-fills the input so a correction starts from what is there.
 */
export function RenameGameForm({
  gameId,
  currentTitle,
}: {
  gameId: string;
  currentTitle: string;
}) {
  const [state, formAction, pending] = useActionState(
    renameGameAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-6)]">
      {state.error && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[color:var(--danger)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}

      <input type="hidden" name="gameId" value={gameId} />
      <Input
        name="title"
        label={rename.titleLabel}
        placeholder={rename.titlePlaceholder}
        defaultValue={currentTitle}
        error={state.titleError}
        autoComplete="off"
        autoFocus
        required
      />

      <div className="flex items-center gap-[var(--space-3)]">
        <Button type="submit" disabled={pending}>
          {pending ? rename.submitting : rename.submit}
        </Button>
        <Link href="/games">
          <Button type="button" variant="ghost">
            {rename.cancel}
          </Button>
        </Link>
      </div>
    </form>
  );
}
