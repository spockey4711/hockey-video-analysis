/**
 * Pure logic for the "Neu eingegangen" review of imported games (P2-18) - no DB,
 * no framework - so it is unit-testable and the page and server actions stay
 * thin.
 *
 * An imported game (P2-9 ingest, later the P2-17 Drive worker) arrives in the
 * needs-a-name state: an empty title, no opponent, and a recording date only
 * when the importer could read a trustworthy one. It waits in the review list
 * until the coach accepts it (gives it a title, an optional opponent and a
 * date) or discards it. Accepting is what moves it into the normal games list,
 * so the empty title stays the single marker of "still to review".
 */
import { gamesContent } from "./content";
import { isUnnamedGame } from "./format";
import {
  validateOpponent,
  validatePlayedOn,
  validateTitle,
} from "./validation";

const { errors } = gamesContent;

/**
 * Split the games into the imported ones still waiting for review and the
 * accepted games the normal list shows, keeping the incoming order in both.
 */
export function partitionIncomingGames<T extends { title: string }>(
  games: readonly T[],
): { incoming: T[]; accepted: T[] } {
  const incoming: T[] = [];
  const accepted: T[] = [];
  for (const game of games) {
    (isUnnamedGame(game.title) ? incoming : accepted).push(game);
  }
  return { incoming, accepted };
}

/** The review form's submission before validation. */
export interface RawGameReview {
  title: string;
  opponent: string;
  playedOn: string;
}

/**
 * An accepted review ready to persist. Unlike the create form, the date is
 * required: an imported game without a trustworthy recording date asks the
 * coach for it here, and an accepted game must never be left undated.
 */
export interface ValidatedGameReview {
  title: string;
  opponent: string | null;
  playedOn: string;
}

export interface GameReviewFieldErrors {
  title?: string;
  opponent?: string;
  playedOn?: string;
}

export type GameReviewResult =
  | { ok: true; value: ValidatedGameReview }
  | { ok: false; fieldErrors: GameReviewFieldErrors };

/** Validate the review form, returning the normalized value or inline errors. */
export function validateGameReview(raw: RawGameReview): GameReviewResult {
  const fieldErrors: GameReviewFieldErrors = {};

  const titleError = validateTitle(raw.title);
  if (titleError) fieldErrors.title = titleError;
  const opponentError = validateOpponent(raw.opponent);
  if (opponentError) fieldErrors.opponent = opponentError;
  const playedOn = raw.playedOn.trim();
  const playedOnError = playedOn
    ? validatePlayedOn(playedOn)
    : errors.playedOnRequired;
  if (playedOnError) fieldErrors.playedOn = playedOnError;

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      title: raw.title.trim(),
      opponent: raw.opponent.trim() || null,
      playedOn,
    },
  };
}

/**
 * The file name of a chapter path, for a compact chapter list: the part after
 * the last `/` or `\`, or the whole path when it has no separator.
 */
export function chapterFileName(filePath: string): string {
  const trimmed = filePath.trim().replace(/[/\\]+$/, "");
  const name = trimmed.split(/[/\\]/).pop();
  return name || filePath;
}
