/**
 * Golden vectors for jump markers: a tag's start as a point on the game
 * timeline, the next and previous marker from the play position (the `,` and
 * `.` keys), the marker the play position sits on, and a marker's place on the
 * timeline.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import {
  activeMarker,
  markerFraction,
  nextMarker,
  previousMarker,
  sortMarkers,
  type JumpMarker,
} from "@/features/player/jump-markers/navigation";

/** Three markers, listed out of order, two of them 0.2 s apart. */
const MARKERS: JumpMarker[] = [
  { id: "c", type: "action_bad", startS: 1500 },
  { id: "a", type: "goal", startS: 300 },
  { id: "b", type: "corner_short", startS: 900 },
  { id: "d", type: "action_good", startS: 900.2 },
];

/** Two markers exactly as far from 900.25 s, within the snap distance. */
const TIED: JumpMarker[] = [
  { id: "p", type: "goal", startS: 900 },
  { id: "q", type: "goal", startS: 900.5 },
];

function sortCase(name: string, markers: JumpMarker[]) {
  return vectorCase(name, "sortMarkers", { markers }, (i) =>
    sortMarkers(i.markers),
  );
}

function nextCase(name: string, markers: JumpMarker[], gameTimeS: number) {
  return vectorCase(name, "nextMarker", { markers, gameTimeS }, (i) =>
    nextMarker(i.markers, i.gameTimeS),
  );
}

function previousCase(name: string, markers: JumpMarker[], gameTimeS: number) {
  return vectorCase(name, "previousMarker", { markers, gameTimeS }, (i) =>
    previousMarker(i.markers, i.gameTimeS),
  );
}

function activeCase(name: string, markers: JumpMarker[], gameTimeS: number) {
  return vectorCase(name, "activeMarker", { markers, gameTimeS }, (i) =>
    activeMarker(i.markers, i.gameTimeS),
  );
}

function fractionCase(name: string, startS: number, totalDurationS: number) {
  return vectorCase(name, "markerFraction", { startS, totalDurationS }, (i) =>
    markerFraction(i.startS, i.totalDurationS),
  );
}

export function buildJumpMarkers(): VectorFile {
  return {
    contract: "jump-markers",
    description:
      "A marker is a tag's start on the game timeline. sortMarkers orders by " +
      "start; markers with the same start keep their order. nextMarker and " +
      "previousMarker are the first marker after, and the last before, the play " +
      "position, skipping any marker within 0.25 s of it so repeated presses " +
      "move on (null at either end). activeMarker is the marker within 0.25 s " +
      "of the play position, the nearest when several are and the one listed " +
      "last on a tie. markerFraction places a start on the timeline in [0, 1], 0 while " +
      "the game has no length.",
    reference: ["src/features/player/jump-markers/navigation.ts"],
    tolerance: DEFAULT_TOLERANCE,
    cases: [
      sortCase("markers in any order", MARKERS),
      sortCase("equal starts keep their order", [
        { id: "x", type: "goal", startS: 60 },
        { id: "y", type: "goal", startS: 60 },
      ]),
      sortCase("nothing to sort", []),

      nextCase("from the game start", MARKERS, 0),
      nextCase("the next from between two markers", MARKERS, 600),
      nextCase("parked on a marker moves on", MARKERS, 300),
      nextCase("just inside the snap distance", MARKERS, 299.8),
      nextCase("just outside the snap distance", MARKERS, 299.7),
      nextCase("the next skips a close pair", MARKERS, 900),
      nextCase("past the last marker", MARKERS, 1500),
      nextCase("no next without markers", [], 10),

      previousCase("from the game end", MARKERS, 4800),
      previousCase("the previous from between two markers", MARKERS, 1200),
      previousCase("parked on a marker moves back", MARKERS, 1500),
      previousCase("the previous skips a close pair", MARKERS, 900.2),
      previousCase("before the first marker", MARKERS, 300),
      previousCase("no previous without markers", [], 10),

      activeCase("on a marker", MARKERS, 300),
      activeCase("within the snap distance", MARKERS, 300.25),
      activeCase("outside the snap distance", MARKERS, 300.3),
      activeCase("the nearest of two close markers", MARKERS, 900.15),
      activeCase("a tie goes to the marker listed last", TIED, 900.25),
      activeCase("a tie in the other order", [...TIED].reverse(), 900.25),
      activeCase("between markers", MARKERS, 600),

      fractionCase("a marker inside the game", 1200, 4800),
      fractionCase("the game start", 0, 4800),
      fractionCase("past the game end is held at 1", 5000, 4800),
      fractionCase("a negative start is held at 0", -5, 4800),
      fractionCase("a game without length", 1200, 0),
    ],
  };
}
