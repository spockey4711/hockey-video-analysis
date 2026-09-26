"use server";

import { redirect } from "next/navigation";

import { gamesContent } from "./content";
import {
  acceptImportedGame,
  createGameWithSources,
  discardImportedGame,
} from "./queries";
import {
  validateGameReview,
  type GameReviewFieldErrors,
  type RawGameReview,
} from "./review";
import {
  validateGame,
  type GameFieldErrors,
  type RawGameSource,
} from "./validation";

import { requireCoach } from "@/features/access";
import { gameFormatContent } from "@/features/game-format/content";
import {
  parseGameFormatChoice,
  type GameFormatField,
} from "@/features/game-format/format";

/** Shape returned to `useActionState`; the empty object is the initial state. */
export interface GameFormState {
  error?: string;
  fieldErrors?: GameFieldErrors;
  /** The game format's field errors, when the coach set an own format. */
  formatErrors?: Partial<Record<GameFormatField, string>>;
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
 * Create a game, its format and its ordered chapter files, then redirect to the
 * games list. Coach-only: `requireCoach` both authorizes the mutation and
 * supplies the `createdBy` author. A game left on the team default stores no
 * format of its own.
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

  const format = parseGameFormatChoice({
    choice: String(formData.get("formatChoice") ?? ""),
    periodCount: String(formData.get("periodCount") ?? ""),
    periodLengthMin: String(formData.get("periodLengthMin") ?? ""),
  });

  if (!result.ok || !format.ok) {
    return {
      fieldErrors: result.ok ? undefined : result.fieldErrors,
      formatErrors: format.ok
        ? undefined
        : Object.fromEntries(
            format.invalid.map((field) => [
              field,
              gameFormatContent.problems[field],
            ]),
          ),
    };
  }

  try {
    await createGameWithSources({
      ...result.value,
      format: format.value,
      createdBy: coach.id,
    });
  } catch {
    return { error: gamesContent.errors.unexpected };
  }

  // `redirect` throws, so it stays outside the try/catch above.
  redirect("/games");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape returned to `useActionState` for the accept form. */
export interface AcceptGameState {
  error?: string;
  fieldErrors?: GameReviewFieldErrors;
  // The submitted values, so the form keeps them after a failed attempt.
  values?: RawGameReview;
}

/**
 * Accept an imported game from the "Neu eingegangen" review (P2-18): set its
 * title, optional opponent and date, which moves it into the normal games list.
 * Coach-only. The game id travels in a hidden field; an invalid id maps to the
 * generic error, and a game that is gone or already accepted maps to
 * `reviewGone` rather than a silent no-op.
 */
export async function acceptImportedGameAction(
  _prev: AcceptGameState,
  formData: FormData,
): Promise<AcceptGameState> {
  await requireCoach();

  const id = String(formData.get("gameId") ?? "");
  const values: RawGameReview = {
    title: String(formData.get("title") ?? ""),
    opponent: String(formData.get("opponent") ?? ""),
    playedOn: String(formData.get("playedOn") ?? ""),
  };

  const result = validateGameReview(values);
  if (!result.ok) {
    return { fieldErrors: result.fieldErrors, values };
  }
  if (!UUID_RE.test(id)) {
    return { error: gamesContent.errors.unexpected, values };
  }

  let updated: boolean;
  try {
    ({ updated } = await acceptImportedGame(id, result.value));
  } catch {
    return { error: gamesContent.errors.unexpected, values };
  }
  if (!updated) {
    return { error: gamesContent.errors.reviewGone, values };
  }

  // `redirect` throws, so it stays outside the try/catch above.
  redirect("/games");
}

/** Shape returned to `useActionState` for the discard control. */
export interface DiscardGameState {
  error?: string;
}

/**
 * Discard an imported game from the review: delete the game and its chapter
 * rows (the video files stay untouched). Coach-only and confirm-gated in the
 * UI; only a game still under review can be discarded, so an accepted game
 * maps to `reviewGone` instead of being deleted.
 */
export async function discardImportedGameAction(
  _prev: DiscardGameState,
  formData: FormData,
): Promise<DiscardGameState> {
  await requireCoach();

  const id = String(formData.get("gameId") ?? "");
  if (!UUID_RE.test(id)) {
    return { error: gamesContent.errors.unexpected };
  }

  let deleted: boolean;
  try {
    ({ deleted } = await discardImportedGame(id));
  } catch {
    return { error: gamesContent.errors.unexpected };
  }
  if (!deleted) {
    return { error: gamesContent.errors.reviewGone };
  }

  // `redirect` throws, so it stays outside the try/catch above.
  redirect("/games");
}
