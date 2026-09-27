/**
 * Golden vectors for quarters: the validated period set a game stores, and
 * the navigation, band, break-skip and clock rules built on it. Periods are
 * half-open [startS, end) in game time; an unset end runs to the next start.
 * The game's format (see `game-format.ts`) is an input: the clock takes the
 * period length and the validation the period count.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import { DEFAULT_GAME_FORMAT } from "@/features/game-format/format";
import { quarterClockS } from "@/features/quarters/clock";
import {
  breakSkipTargetS,
  quarterAt,
  quarterBands,
  quarterWindow,
  type Quarter,
} from "@/features/quarters/navigation";
import { parseQuartersInput } from "@/features/quarters/validation";

const GAME_ID = "00000000-0000-4000-8000-000000000001";
const GAME_LENGTH_S = 4800;

/** Four quarters with every end marked, a half-time break and an open last quarter. */
const MARKED: Quarter[] = [
  { index: 1, startS: 120, endS: 1020 },
  { index: 2, startS: 1200, endS: 2100 },
  { index: 3, startS: 2700, endS: 3600 },
  { index: 4, startS: 3780, endS: null },
];

/** Two 20-minute halves (indoor), both ends marked. */
const HALVES: Quarter[] = [
  { index: 1, startS: 90, endS: 1290 },
  { index: 2, startS: 1800, endS: 3000 },
];

/** Four 10-minute quarters (youth), the last one open. */
const SHORT_QUARTERS: Quarter[] = [
  { index: 1, startS: 30, endS: 630 },
  { index: 2, startS: 700, endS: 1300 },
  { index: 3, startS: 1600, endS: 2200 },
  { index: 4, startS: 2300, endS: null },
];

/** Only the starts marked, listed out of order. */
const STARTS_ONLY: Quarter[] = [
  { index: 2, startS: 1000, endS: null },
  { index: 1, startS: 60, endS: null },
];

function atCase(name: string, quarters: Quarter[], gameTimeS: number) {
  return vectorCase(name, "quarterAt", { quarters, gameTimeS }, (i) =>
    quarterAt(i.quarters, i.gameTimeS),
  );
}

function windowCase(
  name: string,
  quarters: Quarter[],
  index: number,
  totalDurationS: number,
) {
  return vectorCase(
    name,
    "quarterWindow",
    { quarters, index, totalDurationS },
    (i) => quarterWindow(i.quarters, i.index, i.totalDurationS),
  );
}

function bandsCase(name: string, quarters: Quarter[], totalDurationS: number) {
  return vectorCase(name, "quarterBands", { quarters, totalDurationS }, (i) =>
    quarterBands(i.quarters, i.totalDurationS),
  );
}

function skipCase(name: string, quarters: Quarter[], gameTimeS: number) {
  return vectorCase(name, "breakSkipTargetS", { quarters, gameTimeS }, (i) =>
    breakSkipTargetS(i.quarters, i.gameTimeS),
  );
}

function clockCase(
  name: string,
  quarters: Quarter[],
  gameTimeS: number,
  periodLengthS: number = DEFAULT_GAME_FORMAT.periodLengthS,
) {
  return vectorCase(
    name,
    "quarterClockS",
    { quarters, gameTimeS, periodLengthS },
    (i) => quarterClockS(i.quarters, i.gameTimeS, i.periodLengthS),
  );
}

function parseCase(
  name: string,
  body: unknown,
  periodCount: number = DEFAULT_GAME_FORMAT.periodCount,
) {
  return vectorCase(name, "parseQuartersInput", { body, periodCount }, (i) => {
    const result = parseQuartersInput(i.body, i.periodCount);
    // The error is English API text; a port rejects the same bodies in its
    // own words, so only the outcome is pinned.
    return result.ok ? result : { ok: false };
  });
}

export function buildQuarters(): VectorFile {
  return {
    contract: "quarters",
    description:
      "Quarter sets and the rules on them. quarterAt finds the quarter holding a " +
      "game time (null in a break); quarterWindow is a quarter's clip window " +
      "clamped to the game; quarterBands are fractions of the game; " +
      "breakSkipTargetS is where a break jumps to; quarterClockS reads " +
      "(index - 1) * periodLengthS plus the time into the period, and raw game " +
      "time outside periods. parseQuartersInput validates a stored set for a " +
      "game playing periodCount periods: contiguous indices from 1 up to " +
      "periodCount, each start after the previous, no overlap (its English " +
      "error is left out). The period length and count are the game's format " +
      "(game-format.json) and always inputs, never assumed.",
    reference: [
      "src/features/quarters/navigation.ts",
      "src/features/quarters/clock.ts",
      "src/features/quarters/validation.ts",
    ],
    tolerance: DEFAULT_TOLERANCE,
    cases: [
      atCase("before the first quarter", MARKED, 30),
      atCase("a quarter's start is inside it", MARKED, 120),
      atCase("inside the first quarter", MARKED, 500),
      atCase("a marked end is already the break", MARKED, 1020),
      atCase("inside a break", MARKED, 1100),
      atCase("the next start ends the break", MARKED, 1200),
      atCase("an open last quarter runs on", MARKED, 6000),
      atCase("an unset end runs to the next start", STARTS_ONLY, 999.98),
      atCase("the next start begins the next quarter", STARTS_ONLY, 1000),
      atCase("no quarters marked", [], 500),

      windowCase("a marked quarter", MARKED, 1, GAME_LENGTH_S),
      windowCase(
        "an open last quarter ends with the game",
        MARKED,
        4,
        GAME_LENGTH_S,
      ),
      windowCase(
        "an unset end is the next start",
        STARTS_ONLY,
        1,
        GAME_LENGTH_S,
      ),
      windowCase(
        "a quarter that is not marked",
        MARKED.slice(0, 2),
        3,
        GAME_LENGTH_S,
      ),
      windowCase("a quarter starting past the game is empty", MARKED, 4, 3700),

      bandsCase("marked quarters", MARKED, GAME_LENGTH_S),
      bandsCase("starts only", STARTS_ONLY, GAME_LENGTH_S),
      bandsCase("no quarters", [], GAME_LENGTH_S),
      bandsCase("a game without length has no bands", MARKED, 0),

      skipCase("a marked end skips to the next start", MARKED, 1020),
      skipCase("inside a break skips to the next start", MARKED, 1100),
      skipCase("one frame before the next start", MARKED, 1199.98),
      skipCase("the next start itself", MARKED, 1200),
      skipCase("inside a quarter", MARKED, 500),
      skipCase("before the first quarter is never skipped", MARKED, 30),
      skipCase("unset ends leave no break", STARTS_ONLY, 999.98),

      clockCase("before the first quarter runs raw", MARKED, 30),
      clockCase("a quarter start reads its nominal start", MARKED, 120),
      clockCase("the clock inside the first quarter", MARKED, 500),
      clockCase("inside the second quarter", MARKED, 1300),
      clockCase("a break runs raw", MARKED, 1100),
      clockCase("the open last quarter", MARKED, 4000),
      clockCase("ten-minute quarters", MARKED, 2800, 600),
      clockCase("a break runs raw whatever the length", MARKED, 1100, 600),
      clockCase("2 x 20: the first half", HALVES, 690, 1200),
      clockCase("2 x 20: the half-time break runs raw", HALVES, 1500, 1200),
      clockCase("2 x 20: the second half reads 20:00", HALVES, 1800, 1200),
      clockCase("2 x 20: late in the second half", HALVES, 2950, 1200),
      clockCase(
        "4 x 10: the second quarter reads 10:00",
        SHORT_QUARTERS,
        700,
        600,
      ),
      clockCase("4 x 10: inside the third quarter", SHORT_QUARTERS, 1900, 600),
      clockCase("4 x 10: the open last quarter", SHORT_QUARTERS, 2500, 600),

      parseCase("a full set, sorted by index", {
        gameId: GAME_ID,
        quarters: [
          { index: 2, startS: 1200, endS: 2100 },
          { index: 1, startS: 120, endS: 1020 },
        ],
      }),
      parseCase("an unset end is stored as null", {
        gameId: GAME_ID,
        quarters: [{ index: 1, startS: 60 }],
      }),
      parseCase("rejects a body that is not an object", "quarters"),
      parseCase("rejects a malformed game id", {
        gameId: "game-1",
        quarters: [{ index: 1, startS: 60 }],
      }),
      parseCase("rejects an empty set", { gameId: GAME_ID, quarters: [] }),
      parseCase("rejects quarters that are not a list", {
        gameId: GAME_ID,
        quarters: { index: 1, startS: 60 },
      }),
      parseCase("rejects more than four quarters", {
        gameId: GAME_ID,
        quarters: [1, 2, 3, 4, 5].map((index) => ({
          index,
          startS: index * 1000,
        })),
      }),
      parseCase(
        "two halves: a full set",
        { gameId: GAME_ID, quarters: HALVES },
        2,
      ),
      parseCase(
        "two halves: rejects a third period",
        {
          gameId: GAME_ID,
          quarters: [...HALVES, { index: 3, startS: 3100 }],
        },
        2,
      ),
      parseCase(
        "two halves: rejects an index past the count",
        { gameId: GAME_ID, quarters: [{ index: 3, startS: 60 }] },
        2,
      ),
      parseCase(
        "4 x 10: a full set",
        { gameId: GAME_ID, quarters: SHORT_QUARTERS },
        4,
      ),
      parseCase("rejects index 0", {
        gameId: GAME_ID,
        quarters: [{ index: 0, startS: 60 }],
      }),
      parseCase("rejects a fractional index", {
        gameId: GAME_ID,
        quarters: [{ index: 1.5, startS: 60 }],
      }),
      parseCase("rejects a negative start", {
        gameId: GAME_ID,
        quarters: [{ index: 1, startS: -1 }],
      }),
      parseCase("rejects an end at the start", {
        gameId: GAME_ID,
        quarters: [{ index: 1, startS: 60, endS: 60 }],
      }),
      parseCase("rejects a gap in the indices", {
        gameId: GAME_ID,
        quarters: [
          { index: 1, startS: 60 },
          { index: 3, startS: 2000 },
        ],
      }),
      parseCase("rejects a repeated index", {
        gameId: GAME_ID,
        quarters: [
          { index: 1, startS: 60 },
          { index: 1, startS: 2000 },
        ],
      }),
      parseCase("rejects a quarter starting before the previous one", {
        gameId: GAME_ID,
        quarters: [
          { index: 1, startS: 1200 },
          { index: 2, startS: 120 },
        ],
      }),
      parseCase("rejects overlapping quarters", {
        gameId: GAME_ID,
        quarters: [
          { index: 1, startS: 120, endS: 1300 },
          { index: 2, startS: 1200 },
        ],
      }),
    ],
  };
}
