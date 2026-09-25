"use client";

import { playerSetupContent } from "./content";
import type { PlayerFieldErrors } from "./validation";

import { Input } from "@/components/forms/Input";

/** The two editable values, as the controlled inputs hold them. */
export interface PlayerFieldValues {
  name: string;
  jerseyNumber: string;
}

/**
 * The name and jersey-number inputs shared by the add and edit forms. Controlled
 * so typed values survive a failed submit; the server's per-field errors sit
 * under their inputs. The jersey number is a text field with a numeric keypad
 * rather than `type="number"`, so a typo reaches the server as typed and gets a
 * clear message instead of being silently dropped by the browser.
 */
export function PlayerFields({
  values,
  onChange,
  fieldErrors,
}: {
  values: PlayerFieldValues;
  onChange: (values: PlayerFieldValues) => void;
  fieldErrors?: PlayerFieldErrors;
}) {
  return (
    <div className="grid gap-[var(--space-3)] sm:grid-cols-[minmax(0,1fr)_8rem]">
      <Input
        name="name"
        label={playerSetupContent.nameLabel}
        placeholder={playerSetupContent.namePlaceholder}
        value={values.name}
        onChange={(event) => onChange({ ...values, name: event.target.value })}
        error={fieldErrors?.name}
        autoComplete="off"
        required
      />
      <Input
        name="jerseyNumber"
        label={playerSetupContent.jerseyLabel}
        placeholder={playerSetupContent.jerseyPlaceholder}
        value={values.jerseyNumber}
        onChange={(event) =>
          onChange({ ...values, jerseyNumber: event.target.value })
        }
        error={fieldErrors?.jerseyNumber}
        inputMode="numeric"
        autoComplete="off"
      />
    </div>
  );
}
