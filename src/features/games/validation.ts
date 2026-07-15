/**
 * Pure input validation for the create-game form - no DB, no framework - so it
 * is unit-testable and shared by the server action and (implicitly) the UI. The
 * boundary is where we validate: the server action calls `validateGame` before
 * touching the database. Chapter order is positional - the array index becomes
 * `game_sources.order_index`, so callers must preserve submit order.
 */
import { gamesContent } from "./content";

const { errors } = gamesContent;

export const TITLE_MAX_LENGTH = 200;
export const OPPONENT_MAX_LENGTH = 200;
export const PATH_MAX_LENGTH = 1024;
export const MAX_SOURCES = 100;
// A single chapter longer than 24h is a typo, not a real recording.
export const DURATION_MAX_S = 24 * 60 * 60;

// A calendar date with no time component: exactly `YYYY-MM-DD`.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A source chapter as it arrives from the form: both fields still raw strings. */
export interface RawGameSource {
  filePath: string;
  durationS: string;
}

/** The whole create-game submission before validation. */
export interface RawGameInput {
  title: string;
  opponent: string;
  playedOn: string;
  sources: RawGameSource[];
}

/** A validated source ready to persist; `durationS` is a finite positive number. */
export interface ValidatedGameSource {
  filePath: string;
  durationS: number;
}

/** A validated game ready to persist. Optional fields are normalized to `null`. */
export interface ValidatedGame {
  title: string;
  opponent: string | null;
  playedOn: string | null;
  sources: ValidatedGameSource[];
}

/** Per-row source errors, keyed by the row's index in the submitted order. */
export interface GameSourceRowErrors {
  filePath?: string;
  durationS?: string;
}

/** Inline errors for the form; `sourceRows` maps a row index to its errors. */
export interface GameFieldErrors {
  title?: string;
  opponent?: string;
  playedOn?: string;
  sources?: string;
  sourceRows?: Record<number, GameSourceRowErrors>;
}

export type GameValidationResult =
  | { ok: true; value: ValidatedGame }
  | { ok: false; fieldErrors: GameFieldErrors };

/** Validate the game title. Returns an error message or `null` when valid. */
export function validateTitle(raw: string): string | null {
  const title = raw.trim();
  if (!title) return errors.titleRequired;
  if (title.length > TITLE_MAX_LENGTH) return errors.titleTooLong;
  return null;
}

/** Validate the optional opponent name. Returns an error message or `null`. */
export function validateOpponent(raw: string): string | null {
  if (raw.trim().length > OPPONENT_MAX_LENGTH) return errors.opponentTooLong;
  return null;
}

/**
 * Validate the optional played-on date. Empty is allowed; a non-empty value must
 * be a real `YYYY-MM-DD` calendar date (so `2026-02-30` is rejected).
 */
export function validatePlayedOn(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (!DATE_PATTERN.test(value)) return errors.playedOnInvalid;
  // Round-trip through Date to reject impossible days that match the shape.
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return errors.playedOnInvalid;
  if (parsed.toISOString().slice(0, 10) !== value)
    return errors.playedOnInvalid;
  return null;
}

/** Validate a single chapter file path. Returns an error message or `null`. */
export function validateSourcePath(raw: string): string | null {
  const path = raw.trim();
  if (!path) return errors.pathRequired;
  if (path.length > PATH_MAX_LENGTH) return errors.pathTooLong;
  return null;
}

/**
 * Parse and validate a chapter duration in seconds. Accepts a decimal comma
 * (German keyboards) and returns the parsed number alongside any error, so the
 * caller reuses the parse result instead of parsing twice.
 */
export function parseDuration(raw: string): {
  value: number | null;
  error: string | null;
} {
  const text = raw.trim().replace(",", ".");
  if (!text) return { value: null, error: errors.durationRequired };
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) {
    return { value: null, error: errors.durationInvalid };
  }
  if (value > DURATION_MAX_S) {
    return { value: null, error: errors.durationTooLong };
  }
  return { value, error: null };
}

/**
 * Validate a whole create-game submission. On success returns the normalized
 * value ready to persist; otherwise returns inline field errors (including
 * per-row source errors) for the form to display.
 */
export function validateGame(raw: RawGameInput): GameValidationResult {
  const fieldErrors: GameFieldErrors = {};

  const titleError = validateTitle(raw.title);
  if (titleError) fieldErrors.title = titleError;
  const opponentError = validateOpponent(raw.opponent);
  if (opponentError) fieldErrors.opponent = opponentError;
  const playedOnError = validatePlayedOn(raw.playedOn);
  if (playedOnError) fieldErrors.playedOn = playedOnError;

  if (raw.sources.length === 0) {
    fieldErrors.sources = errors.sourcesRequired;
  } else if (raw.sources.length > MAX_SOURCES) {
    fieldErrors.sources = errors.tooManySources;
  }

  const sourceRows: Record<number, GameSourceRowErrors> = {};
  const sources: ValidatedGameSource[] = [];
  raw.sources.forEach((source, index) => {
    const rowErrors: GameSourceRowErrors = {};
    const pathError = validateSourcePath(source.filePath);
    if (pathError) rowErrors.filePath = pathError;
    const { value: durationS, error: durationError } = parseDuration(
      source.durationS,
    );
    if (durationError) rowErrors.durationS = durationError;

    if (rowErrors.filePath || rowErrors.durationS) {
      sourceRows[index] = rowErrors;
    } else {
      sources.push({ filePath: source.filePath.trim(), durationS: durationS! });
    }
  });
  if (Object.keys(sourceRows).length > 0) {
    fieldErrors.sourceRows = sourceRows;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      title: raw.title.trim(),
      opponent: raw.opponent.trim() || null,
      playedOn: raw.playedOn.trim() || null,
      sources,
    },
  };
}
