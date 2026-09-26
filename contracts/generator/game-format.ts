/**
 * Golden vectors for the game format: the period count and length a game
 * plays, resolved from its own columns and the team default, and the rules a
 * format form's input must follow. The quarter clock and the period validation
 * in `quarters.json` take the resolved format as their inputs.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import {
  DEFAULT_GAME_FORMAT,
  MAX_PERIOD_LENGTH_MIN,
  MIN_PERIOD_LENGTH_MIN,
  parseGameFormatInput,
  resolveGameFormat,
  type GameFormat,
  type GameFormatOverride,
} from "@/features/game-format/format";

const INDOOR: GameFormat = { periodCount: 2, periodLengthS: 1200 };

function resolveCase(
  name: string,
  game: GameFormatOverride,
  teamDefault: GameFormat,
) {
  return vectorCase(name, "resolveGameFormat", { game, teamDefault }, (i) =>
    resolveGameFormat(i.game, i.teamDefault),
  );
}

function parseCase(name: string, periodCount: string, periodLengthMin: string) {
  return vectorCase(
    name,
    "parseGameFormatInput",
    { periodCount, periodLengthMin },
    (i) => {
      const result = parseGameFormatInput(i);
      // A port reports a bad field in its own way, so only the outcome and
      // the parsed format are pinned.
      return result.ok ? result : { ok: false };
    },
  );
}

export function buildGameFormat(): VectorFile {
  return {
    contract: "game-format",
    description:
      "A game's format: periodCount periods (4 quarters or 2 halves) of " +
      "periodLengthS seconds each. resolveGameFormat takes each of the game's " +
      "own columns when set and the team default for each null one; a stored " +
      "value outside the rules also falls back to the team default. " +
      "parseGameFormatInput reads a form: the period count as 4 or 2 and the " +
      "length as whole minutes from minPeriodLengthMin to maxPeriodLengthMin, " +
      "returned in seconds. defaultPeriodCount and defaultPeriodLengthS are " +
      "the format a team starts with (4 x 15), not a law.",
    reference: ["src/features/game-format/format.ts"],
    tolerance: DEFAULT_TOLERANCE,
    constants: {
      defaultPeriodCount: DEFAULT_GAME_FORMAT.periodCount,
      defaultPeriodLengthS: DEFAULT_GAME_FORMAT.periodLengthS,
      minPeriodLengthMin: MIN_PERIOD_LENGTH_MIN,
      maxPeriodLengthMin: MAX_PERIOD_LENGTH_MIN,
    },
    cases: [
      resolveCase(
        "a game without its own format plays the team default",
        { periodCount: null, periodLengthS: null },
        DEFAULT_GAME_FORMAT,
      ),
      resolveCase(
        "an indoor team default",
        { periodCount: null, periodLengthS: null },
        INDOOR,
      ),
      resolveCase(
        "a game's own 2 x 20",
        { periodCount: 2, periodLengthS: 1200 },
        DEFAULT_GAME_FORMAT,
      ),
      resolveCase(
        "a game's own 4 x 10",
        { periodCount: 4, periodLengthS: 600 },
        INDOOR,
      ),
      resolveCase(
        "each column falls back on its own",
        { periodCount: null, periodLengthS: 600 },
        INDOOR,
      ),
      resolveCase(
        "a period count outside the rules falls back",
        { periodCount: 3, periodLengthS: 600 },
        DEFAULT_GAME_FORMAT,
      ),
      resolveCase(
        "a length that is not whole minutes falls back",
        { periodCount: 2, periodLengthS: 1230 },
        DEFAULT_GAME_FORMAT,
      ),

      parseCase("four quarters of 15 minutes", "4", "15"),
      parseCase("two halves of 20 minutes", "2", "20"),
      parseCase("four quarters of 10 minutes", "4", "10"),
      parseCase("surrounding spaces are trimmed", " 2 ", " 35 "),
      parseCase("the shortest period", "4", "1"),
      parseCase("the longest period", "2", "60"),
      parseCase("rejects three periods", "3", "20"),
      parseCase("rejects a missing count", "", "15"),
      parseCase("rejects zero minutes", "4", "0"),
      parseCase("rejects more than an hour", "2", "61"),
      parseCase("rejects fractional minutes", "4", "12.5"),
      parseCase("rejects a missing length", "4", ""),
    ],
  };
}
