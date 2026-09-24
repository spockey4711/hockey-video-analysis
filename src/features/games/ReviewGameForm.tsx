"use client";

import Link from "next/link";
import { useActionState } from "react";

import { acceptImportedGameAction, type AcceptGameState } from "./actions";
import { gamesContent } from "./content";

import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";

const { review } = gamesContent;
const initialState: AcceptGameState = {};

/**
 * Accept an imported game from the "Neu eingegangen" review: title, optional
 * opponent and the date. The date pre-fills with what the importer read; when
 * it could not read a trustworthy one the field starts empty and a hint asks
 * the coach for it. After a failed attempt the fields keep what was submitted.
 */
export function ReviewGameForm({
  gameId,
  playedOn,
}: {
  gameId: string;
  playedOn: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    acceptImportedGameAction,
    initialState,
  );
  const values = state.values;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-[var(--space-6)]"
      noValidate
    >
      {state.error && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[color:var(--danger)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}

      <input type="hidden" name="gameId" value={gameId} />
      <div className="flex flex-col gap-[var(--space-4)]">
        <Input
          name="title"
          label={review.titleLabel}
          placeholder={review.titlePlaceholder}
          defaultValue={values?.title ?? ""}
          error={state.fieldErrors?.title}
          autoComplete="off"
          autoFocus
          required
        />
        <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
          <Input
            name="opponent"
            label={review.opponentLabel}
            placeholder={review.opponentPlaceholder}
            defaultValue={values?.opponent ?? ""}
            error={state.fieldErrors?.opponent}
            autoComplete="off"
          />
          <Input
            name="playedOn"
            type="date"
            label={review.playedOnLabel}
            defaultValue={values?.playedOn ?? playedOn ?? ""}
            error={state.fieldErrors?.playedOn}
            hint={playedOn ? undefined : review.dateMissingHint}
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-[var(--space-3)]">
        <Button type="submit" disabled={pending}>
          {pending ? review.accepting : review.accept}
        </Button>
        <Link href="/games">
          <Button type="button" variant="ghost">
            {review.cancel}
          </Button>
        </Link>
      </div>
    </form>
  );
}
