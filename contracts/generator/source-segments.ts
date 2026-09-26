/**
 * Golden vectors for splitting a game-time window across chapter seams (ADR
 * 0002, 0004): one segment per chapter the window touches, with the same
 * half-open rule as the point mapping, so a window ending on a seam never
 * yields a zero-length piece of the next chapter.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import {
  toSourceSegments,
  windowCrossesBoundary,
} from "@/lib/time-mapping/boundaries/source-segments";

/** The same synthetic chapters as the time-mapping vectors. */
const CHAPTERS = [10.026667, 10.010604, 5.5];
const SEAM_1 = CHAPTERS[0];
const GAME_END = CHAPTERS[0] + CHAPTERS[1] + CHAPTERS[2];

/** Chapters of the length a GoPro writes on a large card (about 12 GB). */
const LONG_CHAPTERS = [531.531, 531.531, 212.345];

function segmentsCase(
  name: string,
  durationsS: number[],
  startS: number,
  endS: number,
) {
  return vectorCase(
    name,
    "toSourceSegments",
    { durationsS, startS, endS },
    (i) => toSourceSegments(i.durationsS, i.startS, i.endS),
  );
}

function crossesCase(
  name: string,
  durationsS: number[],
  startS: number,
  endS: number,
) {
  return vectorCase(
    name,
    "windowCrossesBoundary",
    { durationsS, startS, endS },
    (i) => windowCrossesBoundary(i.durationsS, i.startS, i.endS),
  );
}

export function buildSourceSegments(): VectorFile {
  return {
    contract: "source-segments",
    description:
      "A game-time window [startS, endS] split into the ordered per-chapter " +
      "segments [localStartS, localEndS) it covers. A window may cross any number " +
      "of seams; one ending exactly on a seam stops at the earlier chapter's end.",
    reference: ["src/lib/time-mapping/boundaries/source-segments.ts"],
    tolerance: DEFAULT_TOLERANCE,
    cases: [
      segmentsCase("a window inside one chapter", CHAPTERS, 3.3, 6.3),
      segmentsCase("a window across the first seam", CHAPTERS, 9.3, 12.3),
      segmentsCase("a window over a whole middle chapter", CHAPTERS, 8, 22),
      segmentsCase("a window ending exactly on a seam", CHAPTERS, 5, SEAM_1),
      segmentsCase("a window starting exactly on a seam", CHAPTERS, SEAM_1, 13),
      segmentsCase("the whole game", CHAPTERS, 0, GAME_END),
      segmentsCase(
        "a goal window inside a long chapter",
        LONG_CHAPTERS,
        515,
        530,
      ),
      segmentsCase(
        "a goal window across a long chapter's seam",
        LONG_CHAPTERS,
        518,
        533,
      ),
      segmentsCase("rejects an empty window", CHAPTERS, 5, 5),
      segmentsCase("rejects a reversed window", CHAPTERS, 6, 5),
      segmentsCase("rejects a window starting before 0", CHAPTERS, -1, 2),
      segmentsCase("rejects a window ending past the game", CHAPTERS, 20, 26),
      segmentsCase("rejects a layout without chapters", [], 0, 1),

      crossesCase(
        "a window inside one chapter does not cross",
        CHAPTERS,
        3.3,
        6.3,
      ),
      crossesCase("a window across a seam crosses", CHAPTERS, 9.3, 12.3),
      crossesCase(
        "a window ending on a seam does not cross",
        CHAPTERS,
        5,
        SEAM_1,
      ),
      crossesCase(
        "an empty window is rejected before crossing",
        CHAPTERS,
        5,
        5,
      ),
    ],
  };
}
