"use client";

import { useActionState } from "react";

import { FormStatus } from "./FormStatus";
import { GameFormatFields } from "./GameFormatFields";
import { updateGameFormatAction, type GameFormatFormState } from "./actions";
import { gameFormatContent } from "./content";
import type { GameFormat } from "./format";

import { Button } from "@/components/forms/Button";
import { keepValuesOnSubmit } from "@/components/forms/keep-values-on-submit";

const { game } = gameFormatContent;
const initialState: GameFormatFormState = {};

export interface GameFormatFormProps {
  readonly gameId: string;
  readonly teamDefault: GameFormat;
  /** The game's own format, or `null` when it plays the team default. */
  readonly format: GameFormat | null;
  /** The highest period marked on the game, 0 when none is. */
  readonly markedPeriods: number;
}

/** One game's format on its settings page: the team default or its own. */
export function GameFormatForm({
  gameId,
  teamDefault,
  format,
  markedPeriods,
}: GameFormatFormProps) {
  const [state, formAction, pending] = useActionState(
    updateGameFormatAction,
    initialState,
  );
  const onSubmit = keepValuesOnSubmit(formAction);

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="flex flex-col gap-[var(--space-4)]"
      noValidate
    >
      <input type="hidden" name="gameId" value={gameId} />
      <FormStatus state={state} success={game.success} />
      <GameFormatFields
        teamDefault={teamDefault}
        initialFormat={format}
        markedPeriods={markedPeriods}
        errors={state.fieldErrors}
      />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? game.submitting : game.submit}
        </Button>
      </div>
    </form>
  );
}
