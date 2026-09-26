"use client";

import { useState } from "react";

import { PeriodFields, type PeriodFieldValues } from "./PeriodFields";
import { gameFormatContent } from "./content";
import {
  firstDroppedPeriod,
  isPeriodCount,
  periodLengthMinutes,
  type GameFormat,
  type GameFormatChoice,
  type GameFormatField,
} from "./format";

import { Icon } from "@/components/core/Icon";
import { Select } from "@/components/forms/Select";

const { game } = gameFormatContent;

export interface GameFormatFieldsProps {
  /** The team default, named in the choice and used to seed the fields. */
  readonly teamDefault: GameFormat;
  /** The game's own format, or `null` when it plays the team default. */
  readonly initialFormat: GameFormat | null;
  /**
   * The highest period marked on the game, so switching to fewer periods can
   * warn which marks the save removes. Omitted for a game not yet created.
   */
  readonly markedPeriods?: number;
  readonly errors?: Partial<Record<GameFormatField, string>>;
}

function fieldValues(format: GameFormat): PeriodFieldValues {
  return {
    periodCount: String(format.periodCount),
    periodLengthMin: String(periodLengthMinutes(format)),
  };
}

/**
 * A game's format inside a form: the team default, or the game's own period
 * count and length. The own-format fields only show once chosen; they start
 * from the team default, so a coach changes just what differs.
 */
export function GameFormatFields({
  teamDefault,
  initialFormat,
  markedPeriods = 0,
  errors,
}: GameFormatFieldsProps) {
  const [choice, setChoice] = useState<GameFormatChoice>(
    initialFormat ? "custom" : "team",
  );
  const [values, setValues] = useState<PeriodFieldValues>(
    fieldValues(initialFormat ?? teamDefault),
  );

  const chosenCount =
    choice === "team" ? teamDefault.periodCount : Number(values.periodCount);
  const dropped = isPeriodCount(chosenCount)
    ? firstDroppedPeriod(markedPeriods, chosenCount)
    : null;

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <Select
        name="formatChoice"
        label={game.choiceLabel}
        value={choice}
        onChange={(event) =>
          setChoice(event.target.value === "custom" ? "custom" : "team")
        }
        options={[
          { value: "team", label: game.teamOption(teamDefault) },
          { value: "custom", label: game.customOption },
        ]}
      />
      {choice === "custom" && (
        <PeriodFields values={values} onChange={setValues} errors={errors} />
      )}
      {dropped !== null && (
        <p
          role="status"
          className="flex items-start gap-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--text-primary)]"
        >
          {/* The --warning hue marks the note; the text keeps full contrast
              in both themes. */}
          <span className="flex h-[1lh] shrink-0 items-center text-[color:var(--warning)]">
            <Icon name="alert-triangle" size={16} />
          </span>
          {game.dropWarning(dropped)}
        </p>
      )}
    </div>
  );
}
