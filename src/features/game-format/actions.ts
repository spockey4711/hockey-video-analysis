"use server";

import { revalidatePath } from "next/cache";

import { gameFormatContent } from "./content";
import {
  parseGameFormatChoice,
  parseGameFormatInput,
  type GameFormatField,
} from "./format";
import { setTeamGameFormat, updateGameFormat } from "./queries";

import { requireCoach } from "@/features/access";

const { problems, errors } = gameFormatContent;

/** Shape returned to `useActionState`; the empty object is the initial state. */
export interface GameFormatFormState {
  error?: string;
  fieldErrors?: Partial<Record<GameFormatField, string>>;
  success?: boolean;
}

function fieldErrorsOf(
  invalid: readonly GameFormatField[],
): Partial<Record<GameFormatField, string>> {
  return Object.fromEntries(invalid.map((field) => [field, problems[field]]));
}

function formText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

/** Set the team's default game format (Einstellungen > Spiel). Coach-only. */
export async function setTeamGameFormatAction(
  _prev: GameFormatFormState,
  formData: FormData,
): Promise<GameFormatFormState> {
  await requireCoach();

  const parsed = parseGameFormatInput({
    periodCount: formText(formData, "periodCount"),
    periodLengthMin: formText(formData, "periodLengthMin"),
  });
  if (!parsed.ok) return { fieldErrors: fieldErrorsOf(parsed.invalid) };

  try {
    await setTeamGameFormat(parsed.value);
  } catch (cause) {
    console.error("failed to set the team game format", cause);
    return { error: errors.unexpected };
  }
  revalidatePath("/settings");
  return { success: true };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Set one game's format, or put it back on the team default. Coach-only. The
 * game id travels in a hidden field; a malformed id maps to the generic error
 * and a game that is gone to `gameGone`.
 */
export async function updateGameFormatAction(
  _prev: GameFormatFormState,
  formData: FormData,
): Promise<GameFormatFormState> {
  await requireCoach();

  const gameId = formText(formData, "gameId");
  if (!UUID_RE.test(gameId)) return { error: errors.unexpected };

  const parsed = parseGameFormatChoice({
    choice: formText(formData, "formatChoice"),
    periodCount: formText(formData, "periodCount"),
    periodLengthMin: formText(formData, "periodLengthMin"),
  });
  if (!parsed.ok) return { fieldErrors: fieldErrorsOf(parsed.invalid) };

  let updated: boolean;
  try {
    updated = await updateGameFormat(gameId, parsed.value);
  } catch (cause) {
    console.error("failed to update a game format", cause);
    return { error: errors.unexpected };
  }
  if (!updated) return { error: errors.gameGone };

  revalidatePath(`/games/${gameId}/settings`);
  return { success: true };
}
