/**
 * Golden vectors for the global game-time mapping (ADR 0002): a game time to
 * `(chapter, local offset)` and back, with the half-open seam rule and the
 * exact game end as the one closed point.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import {
  toGameTime,
  toSourcePoint,
  totalDurationS,
} from "@/lib/time-mapping/game-time-map";

/**
 * Three chapters whose lengths come from a synthetic 4K recording split with
 * ffmpeg: fractional container durations, as `game_sources.duration_s` stores
 * them. The seams are summed in chapter order, as every port must.
 */
const CHAPTERS = [10.026667, 10.010604, 5.5];
const SEAM_1 = CHAPTERS[0];
const SEAM_2 = CHAPTERS[0] + CHAPTERS[1];
const GAME_END = SEAM_2 + CHAPTERS[2];

/** One frame at 50 fps. */
const FRAME_S = 0.02;

function pointCase(name: string, durationsS: number[], gameTimeS: number) {
  return vectorCase(name, "toSourcePoint", { durationsS, gameTimeS }, (i) =>
    toSourcePoint(i.durationsS, i.gameTimeS),
  );
}

function gameTimeCase(
  name: string,
  durationsS: number[],
  sourceIndex: number,
  localOffsetS: number,
) {
  return vectorCase(
    name,
    "toGameTime",
    { durationsS, sourceIndex, localOffsetS },
    (i) =>
      toGameTime(i.durationsS, {
        sourceIndex: i.sourceIndex,
        localOffsetS: i.localOffsetS,
      }),
  );
}

function totalCase(name: string, durationsS: number[]) {
  return vectorCase(name, "totalDurationS", { durationsS }, (i) =>
    totalDurationS(i.durationsS),
  );
}

export function buildTimeMapping(): VectorFile {
  return {
    contract: "time-mapping",
    description:
      "Global game time <-> (chapter index, local offset) over the ordered chapter " +
      "durations. Chapters are half-open [start, start + duration): a time on an " +
      "interior seam belongs to the next chapter, and only the exact game end maps " +
      "to the end of the last chapter.",
    reference: ["src/lib/time-mapping/game-time-map.ts"],
    tolerance: DEFAULT_TOLERANCE,
    cases: [
      totalCase("sums the chapters in order", CHAPTERS),
      totalCase("a single chapter is the whole game", [3600]),
      totalCase("rejects a game without chapters", []),
      totalCase("a zero-length chapter is no layout", [600, 0, 300]),
      totalCase("a negative chapter is no layout", [600, -1]),

      pointCase("game start is chapter 0 at 0", CHAPTERS, 0),
      pointCase("a time inside the first chapter", CHAPTERS, 3.3),
      pointCase("one frame before the first seam", CHAPTERS, SEAM_1 - FRAME_S),
      pointCase("the first seam starts chapter 1", CHAPTERS, SEAM_1),
      pointCase("a time inside the second chapter", CHAPTERS, 12.29),
      pointCase("the second seam starts chapter 2", CHAPTERS, SEAM_2),
      pointCase(
        "the game end is the end of the last chapter",
        CHAPTERS,
        GAME_END,
      ),
      pointCase("a single chapter keeps the time", [3600], 1234.5),
      pointCase(
        "rejects a time past the game end",
        CHAPTERS,
        GAME_END + FRAME_S,
      ),
      pointCase("rejects a negative time", CHAPTERS, -FRAME_S),
      pointCase("rejects a layout without chapters", [], 0),
      pointCase(
        "rejects a point in a layout with a zero-length chapter",
        [600, 0],
        10,
      ),

      gameTimeCase("chapter 0 at 0 is the game start", CHAPTERS, 0, 0),
      gameTimeCase("chapter 1 at 0 is the first seam", CHAPTERS, 1, 0),
      gameTimeCase("a local offset inside chapter 1", CHAPTERS, 1, 2.263333),
      gameTimeCase(
        "the exclusive end of chapter 0 is the first seam",
        CHAPTERS,
        0,
        CHAPTERS[0],
      ),
      gameTimeCase(
        "the end of the last chapter is the game end",
        CHAPTERS,
        2,
        5.5,
      ),
      gameTimeCase("rejects a chapter past the last", CHAPTERS, 3, 0),
      gameTimeCase("rejects a negative chapter index", CHAPTERS, -1, 0),
      gameTimeCase("rejects a fractional chapter", CHAPTERS, 0.5, 0),
      gameTimeCase("rejects a negative local offset", CHAPTERS, 1, -FRAME_S),
      gameTimeCase(
        "rejects a local offset past the chapter end",
        CHAPTERS,
        2,
        5.5 + FRAME_S,
      ),
    ],
  };
}
