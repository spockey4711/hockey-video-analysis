/**
 * Pure input validation for adding and editing a player - no DB, no framework -
 * so it is unit-testable and runs in the server actions before any query. Both
 * fields arrive as raw form strings.
 *
 * Duplicate jersey numbers are allowed on purpose: `players.jersey_number` has no
 * unique constraint, and a number can legitimately repeat (a departed player's
 * number reused, two squads sharing one roster).
 */
import { playerSetupContent } from "./content";

const { errors } = playerSetupContent;

export const NAME_MAX_LENGTH = 100;
export const JERSEY_MIN = 1;
export const JERSEY_MAX = 99;

// Digits only: rejects signs, decimals and exponents that `Number()` would accept.
const JERSEY_PATTERN = /^\d{1,2}$/;

/** A player's fields as they arrive from the form, still raw strings. */
export interface RawPlayerInput {
  name: string;
  jerseyNumber: string;
}

/** A validated player ready to persist; an empty jersey number becomes `null`. */
export interface ValidatedPlayer {
  name: string;
  jerseyNumber: number | null;
}

/** Inline errors for the add/edit forms. */
export interface PlayerFieldErrors {
  name?: string;
  jerseyNumber?: string;
}

export type PlayerValidationResult =
  | { ok: true; value: ValidatedPlayer }
  | { ok: false; fieldErrors: PlayerFieldErrors };

/** Validate and normalize a player's name and optional jersey number. */
export function validatePlayer(raw: RawPlayerInput): PlayerValidationResult {
  const fieldErrors: PlayerFieldErrors = {};

  const name = raw.name.trim();
  if (!name) fieldErrors.name = errors.nameRequired;
  else if (name.length > NAME_MAX_LENGTH) fieldErrors.name = errors.nameTooLong;

  const jerseyRaw = raw.jerseyNumber.trim();
  let jerseyNumber: number | null = null;
  if (jerseyRaw) {
    const parsed = JERSEY_PATTERN.test(jerseyRaw) ? Number(jerseyRaw) : NaN;
    if (parsed >= JERSEY_MIN && parsed <= JERSEY_MAX) jerseyNumber = parsed;
    else fieldErrors.jerseyNumber = errors.jerseyInvalid;
  }

  if (fieldErrors.name || fieldErrors.jerseyNumber) {
    return { ok: false, fieldErrors };
  }
  return { ok: true, value: { name, jerseyNumber } };
}
