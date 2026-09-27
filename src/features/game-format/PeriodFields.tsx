"use client";

import { gameFormatContent } from "./content";
import {
  MAX_PERIOD_LENGTH_MIN,
  MIN_PERIOD_LENGTH_MIN,
  PERIOD_COUNTS,
  type GameFormatField,
} from "./format";

import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";

/** The raw values of the two format fields, as the form holds them. */
export interface PeriodFieldValues {
  readonly periodCount: string;
  readonly periodLengthMin: string;
}

export interface PeriodFieldsProps {
  readonly values: PeriodFieldValues;
  readonly onChange: (values: PeriodFieldValues) => void;
  readonly errors?: Partial<Record<GameFormatField, string>>;
}

const PERIOD_COUNT_OPTIONS = PERIOD_COUNTS.map((count) => ({
  value: String(count),
  label: gameFormatContent.periodCountOption(count),
}));

/**
 * The period count and the minutes per period, side by side: the two inputs
 * every format form shares. Controlled, so the values survive a failed submit
 * and a save that re-renders the page with the stored format.
 */
export function PeriodFields({ values, onChange, errors }: PeriodFieldsProps) {
  return (
    <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
      <div className="flex flex-col gap-[var(--space-1)]">
        <Select
          name="periodCount"
          label={gameFormatContent.periodCountLabel}
          options={PERIOD_COUNT_OPTIONS}
          value={values.periodCount}
          aria-invalid={errors?.periodCount ? true : undefined}
          onChange={(event) =>
            onChange({ ...values, periodCount: event.target.value })
          }
        />
        {errors?.periodCount && (
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]">
            {errors.periodCount}
          </p>
        )}
      </div>
      <Input
        name="periodLengthMin"
        type="number"
        inputMode="numeric"
        min={MIN_PERIOD_LENGTH_MIN}
        max={MAX_PERIOD_LENGTH_MIN}
        step={1}
        label={gameFormatContent.periodLengthLabel}
        value={values.periodLengthMin}
        error={errors?.periodLengthMin}
        onChange={(event) =>
          onChange({ ...values, periodLengthMin: event.target.value })
        }
      />
    </div>
  );
}
