"use client";

import { useActionState, useState } from "react";

import { createGameAction, type GameFormState } from "./actions";
import { gamesContent } from "./content";

import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import { Input } from "@/components/forms/Input";

const { create } = gamesContent;
const initialState: GameFormState = {};

/** A single editable chapter row in the form's controlled source list. */
interface SourceRow {
  filePath: string;
  durationS: string;
}

const emptyRow: SourceRow = { filePath: "", durationS: "" };

/**
 * Create-game form: title/date/opponent plus a dynamic, ordered list of chapter
 * files. The source rows are React-controlled so their values (and server-side
 * per-row errors) survive the action round-trip; row order is submit order,
 * which becomes `game_sources.order_index`.
 */
export function GameForm() {
  const [state, formAction, pending] = useActionState(
    createGameAction,
    initialState,
  );
  const [rows, setRows] = useState<SourceRow[]>([emptyRow]);

  function updateRow(index: number, patch: Partial<SourceRow>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [...current, { ...emptyRow }]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  const rowErrors = state.fieldErrors?.sourceRows ?? {};

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

      <div className="flex flex-col gap-[var(--space-4)]">
        <Input
          name="title"
          label={create.titleLabel}
          placeholder={create.titlePlaceholder}
          error={state.fieldErrors?.title}
          autoComplete="off"
          required
        />
        <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
          <Input
            name="opponent"
            label={create.opponentLabel}
            placeholder={create.opponentPlaceholder}
            error={state.fieldErrors?.opponent}
            autoComplete="off"
          />
          <Input
            name="playedOn"
            type="date"
            label={create.playedOnLabel}
            error={state.fieldErrors?.playedOn}
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-[var(--space-3)]">
        <legend className="text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-wide)] text-[color:var(--text-secondary)] uppercase">
          {create.sourcesHeading}
        </legend>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {create.sourcesHint}
        </p>
        {state.fieldErrors?.sources && (
          <p
            role="alert"
            className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
          >
            {state.fieldErrors.sources}
          </p>
        )}

        <ol className="flex flex-col gap-[var(--space-3)]">
          {rows.map((row, index) => (
            <li
              key={index}
              className="flex items-start gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)] p-[var(--space-3)]"
            >
              <span
                aria-hidden
                className="mt-[var(--space-2)] w-[var(--space-6)] shrink-0 text-center text-[length:var(--fs-body-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--text-muted)]"
              >
                {index + 1}
              </span>
              <div className="grid flex-1 gap-[var(--space-3)] sm:grid-cols-[1fr_10rem]">
                <Input
                  name="sourcePath"
                  label={create.pathLabel}
                  placeholder={create.pathPlaceholder}
                  value={row.filePath}
                  onChange={(event) =>
                    updateRow(index, { filePath: event.target.value })
                  }
                  error={rowErrors[index]?.filePath}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Input
                  name="sourceDuration"
                  type="text"
                  inputMode="decimal"
                  label={create.durationLabel}
                  placeholder={create.durationPlaceholder}
                  value={row.durationS}
                  onChange={(event) =>
                    updateRow(index, { durationS: event.target.value })
                  }
                  error={rowErrors[index]?.durationS}
                  autoComplete="off"
                />
              </div>
              <IconButton
                type="button"
                name="trash-2"
                label={create.removeSource}
                variant="ghost"
                size="sm"
                className="mt-[var(--space-5)]"
                disabled={rows.length === 1}
                onClick={() => removeRow(index)}
              />
            </li>
          ))}
        </ol>

        <div>
          <Button type="button" variant="secondary" size="sm" onClick={addRow}>
            {create.addSource}
          </Button>
        </div>
      </fieldset>

      <Button type="submit" full disabled={pending}>
        {pending ? create.submitting : create.submit}
      </Button>
    </form>
  );
}
