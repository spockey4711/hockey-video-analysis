"use client";

import { useActionState, useState } from "react";

import { FormStatus } from "./FormStatus";
import { PeriodFields, type PeriodFieldValues } from "./PeriodFields";
import { setTeamGameFormatAction, type GameFormatFormState } from "./actions";
import { gameFormatContent } from "./content";
import { periodLengthMinutes, type GameFormat } from "./format";

import { Button } from "@/components/forms/Button";
import { keepValuesOnSubmit } from "@/components/forms/keep-values-on-submit";

const { team } = gameFormatContent;
const initialState: GameFormatFormState = {};

export interface TeamFormatFormProps {
  /** The team default as stored. */
  readonly format: GameFormat;
}

/**
 * The team's default game format on the settings page: the period count and
 * the minutes per period every game without its own format plays.
 */
export function TeamFormatForm({ format }: TeamFormatFormProps) {
  const [state, formAction, pending] = useActionState(
    setTeamGameFormatAction,
    initialState,
  );
  const onSubmit = keepValuesOnSubmit(formAction);
  const [values, setValues] = useState<PeriodFieldValues>({
    periodCount: String(format.periodCount),
    periodLengthMin: String(periodLengthMinutes(format)),
  });

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="flex flex-col gap-[var(--space-4)]"
      noValidate
    >
      <FormStatus state={state} success={team.success} />
      <PeriodFields
        values={values}
        onChange={setValues}
        errors={state.fieldErrors}
      />
      <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
        {team.hint}
      </p>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? team.submitting : team.submit}
        </Button>
      </div>
    </form>
  );
}
