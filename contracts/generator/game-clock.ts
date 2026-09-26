/**
 * Golden vectors for the game clock the player shows: `M:SS`, or `H:MM:SS`
 * from the first hour on, fractions floored, and a bad value read as `0:00`.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import { formatGameClock } from "@/features/player/format-timecode";

function clockCase(name: string, totalSeconds: number) {
  return vectorCase(name, "formatGameClock", { totalSeconds }, (i) =>
    formatGameClock(i.totalSeconds),
  );
}

export function buildGameClock(): VectorFile {
  return {
    contract: "game-clock",
    description:
      "formatGameClock writes a game time in seconds as M:SS, or H:MM:SS once " +
      "the game reaches an hour. Fractions of a second are floored, and a " +
      "negative time reads 0:00 (non-finite input too, which JSON cannot carry).",
    reference: ["src/features/player/format-timecode.ts"],
    tolerance: DEFAULT_TOLERANCE,
    cases: [
      clockCase("the game start", 0),
      clockCase("under a minute", 7),
      clockCase("a fraction is floored", 59.999),
      clockCase("one minute", 60),
      clockCase("minutes keep no padding", 754.5),
      clockCase("just under an hour", 3599.98),
      clockCase("the first hour", 3600),
      clockCase("minutes are padded after an hour", 3725.02),
      clockCase("a long game", 36000),
      clockCase("a negative time", -2),
    ],
  };
}
