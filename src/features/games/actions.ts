"use server";

import { redirect } from "next/navigation";

import { gamesContent } from "./content";
import { createGameWithSources, renameGame } from "./queries";
import {
  validateGame,
  validateTitle,
  type GameFieldErrors,
  type RawGameSource,
} from "./validation";

import { requireCoach } from "@/features/access";

/** Shape returned to `useActionState`; the empty object is the initial state. */
export interface GameFormState {
  error?: string;
  fieldErrors?: GameFieldErrors;
}

/**
 * Zip the parallel `sourcePath`/`sourceDuration` form fields back into ordered
 * rows. The two lists arrive in submit order, so index `i` pairs the same row.
 */
function readSources(formData: FormData): RawGameSource[] {
  const paths = formData.getAll("sourcePath").map(String);
  const durations = formData.getAll("sourceDuration").map(String);
  const count = Math.max(paths.length, durations.length);
  const sources: RawGameSource[] = [];
  for (let i = 0; i < count; i += 1) {
    sources.push({ filePath: paths[i] ?? "", durationS: durations[i] ?? "" });
  }
  return sources;
}

/**
 * Create a game and its ordered chapter files, then redirect to the games list.
 * Coach-only: `requireCoach` both authorizes the mutation and supplies the
 * `createdBy` author.
 */
export async function createGameAction(
  _prev: GameFormState,
  formData: FormData,
): Promise<GameFormState> {
  const coach = await requireCoach();

  const result = validateGame({
    title: String(formData.get("title") ?? ""),
    opponent: String(formData.get("opponent") ?? ""),
    playedOn: String(formData.get("playedOn") ?? ""),
    sources: readSources(formData),
  });

  if (!result.ok) {
    return { fieldErrors: result.fieldErrors };
  }

  try {
    await createGameWithSources({ ...result.value, createdBy: coach.id });
  } catch {
    return { error: gamesContent.errors.unexpected };
  }

  // `redirect` throws, so it stays outside the try/catch above.
  redirect("/games");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape returned to `useActionState` for the rename form. */
export interface RenameGameState {
  error?: string;
  titleError?: string;
}

/**
 * Name (or rename) a game - the coach titling an auto-ingested game, or fixing
 * any title. Coach-only, matching the rest of the private games workspace. The
 * game id travels in a hidden field; a missing game or invalid id maps to the
 * generic error rather than a silent no-op.
 */
export async function renameGameAction(
  _prev: RenameGameState,
  formData: FormData,
): Promise<RenameGameState> {
  await requireCoach();

  const id = String(formData.get("gameId") ?? "");
  const rawTitle = String(formData.get("title") ?? "");

  const titleError = validateTitle(rawTitle);
  if (titleError) {
    return { titleError };
  }
  if (!UUID_RE.test(id)) {
    return { error: gamesContent.errors.unexpected };
  }

  let updated: boolean;
  try {
    ({ updated } = await renameGame(id, rawTitle.trim()));
  } catch {
    return { error: gamesContent.errors.unexpected };
  }
  if (!updated) {
    return { error: gamesContent.errors.unexpected };
  }

  // `redirect` throws, so it stays outside the try/catch above.
  redirect("/games");
}
