"use server";

import { redirect } from "next/navigation";

import { gamesContent } from "./content";
import { createGameWithSources } from "./queries";
import {
  validateGame,
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
