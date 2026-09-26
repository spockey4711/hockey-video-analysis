/**
 * The game format: how many periods a game has and how long each one is
 * nominally. A field-hockey game is 4 x 15 minutes by default, but the indoor
 * season, youth games and friendlies play other formats (2 x 20, 4 x 10), and
 * the quarter clock, the quarter editor's rows and the report's period split all
 * read the format of the game at hand.
 *
 * A game stores its own format or leaves both columns empty; an empty column
 * means the team default (`team_settings`). Pure and framework-free, so the
 * resolution and the input rules are unit-tested and shared by the forms, the
 * API and the golden vectors a port is tested against.
 */

/** The period counts a game can have: four quarters or two halves. */
export const PERIOD_COUNTS = [4, 2] as const;

export type PeriodCount = (typeof PERIOD_COUNTS)[number];

/** A game's format: its period count and each period's nominal length. */
export interface GameFormat {
  readonly periodCount: PeriodCount;
  /** Nominal length of one period, in whole seconds. */
  readonly periodLengthS: number;
}

/** The format a team starts with: four quarters of 15 minutes. */
export const DEFAULT_GAME_FORMAT: GameFormat = {
  periodCount: 4,
  periodLengthS: 15 * 60,
};

/** The shortest and longest period a coach can set, in whole minutes. */
export const MIN_PERIOD_LENGTH_MIN = 1;
export const MAX_PERIOD_LENGTH_MIN = 60;

/** A game's own format columns as stored; `null` means the team default. */
export interface GameFormatOverride {
  readonly periodCount: number | null;
  readonly periodLengthS: number | null;
}

/** Whether `value` is a period count a game can have. */
export function isPeriodCount(value: unknown): value is PeriodCount {
  return PERIOD_COUNTS.includes(value as PeriodCount);
}

/** Whether `value` is a period length in seconds a game can have. */
export function isPeriodLengthS(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value % 60 === 0 &&
    value >= MIN_PERIOD_LENGTH_MIN * 60 &&
    value <= MAX_PERIOD_LENGTH_MIN * 60
  );
}

/**
 * The format a game plays: each of its own columns when set, the team default
 * for each one left empty. A stored value outside the rules (only possible by
 * hand in the database) falls back to the team default too, so the clock never
 * runs on a nonsense length.
 */
export function resolveGameFormat(
  game: GameFormatOverride,
  teamDefault: GameFormat,
): GameFormat {
  return {
    periodCount: isPeriodCount(game.periodCount)
      ? game.periodCount
      : teamDefault.periodCount,
    periodLengthS: isPeriodLengthS(game.periodLengthS)
      ? game.periodLengthS
      : teamDefault.periodLengthS,
  };
}

/** A field of a format form. */
export type GameFormatField = "periodCount" | "periodLengthMin";

export type GameFormatParseResult =
  | { readonly ok: true; readonly value: GameFormat }
  | { readonly ok: false; readonly invalid: readonly GameFormatField[] };

/**
 * Parse an untrusted format form: the period count as one of
 * {@link PERIOD_COUNTS} and the period length as whole minutes in
 * `MIN_PERIOD_LENGTH_MIN..MAX_PERIOD_LENGTH_MIN`. The length is stored in
 * seconds, like every other time in the app.
 */
export function parseGameFormatInput(raw: {
  readonly periodCount: string;
  readonly periodLengthMin: string;
}): GameFormatParseResult {
  const periodCount = Number(raw.periodCount.trim());
  const minutesText = raw.periodLengthMin.trim();
  const periodLengthS = /^\d+$/.test(minutesText)
    ? Number(minutesText) * 60
    : NaN;

  const invalid: GameFormatField[] = [];
  if (!isPeriodCount(periodCount)) invalid.push("periodCount");
  if (!isPeriodLengthS(periodLengthS)) invalid.push("periodLengthMin");
  if (!isPeriodCount(periodCount) || invalid.length > 0) {
    return { ok: false, invalid };
  }
  return { ok: true, value: { periodCount, periodLengthS } };
}

/** A format's period length in whole minutes, for the forms. */
export function periodLengthMinutes(format: GameFormat): number {
  return Math.round(format.periodLengthS / 60);
}

/** How a game's format form chooses: the team default, or its own format. */
export type GameFormatChoice = "team" | "custom";

export type GameFormatChoiceResult =
  | { readonly ok: true; readonly value: GameFormat | null }
  | { readonly ok: false; readonly invalid: readonly GameFormatField[] };

/**
 * Parse a game's untrusted format form into the game's own format, or `null`
 * for the team default. Only an explicit `custom` choice reads the fields, so
 * a missing or unknown choice safely means the team default.
 */
export function parseGameFormatChoice(raw: {
  readonly choice: string;
  readonly periodCount: string;
  readonly periodLengthMin: string;
}): GameFormatChoiceResult {
  if (raw.choice !== "custom") return { ok: true, value: null };
  return parseGameFormatInput(raw);
}

/**
 * The first marked period a switch to `periodCount` periods would remove, or
 * `null` when every marked period still fits. `markedPeriods` is the highest
 * period index marked on the game (0 when none is).
 */
export function firstDroppedPeriod(
  markedPeriods: number,
  periodCount: PeriodCount,
): number | null {
  return markedPeriods > periodCount ? periodCount + 1 : null;
}
