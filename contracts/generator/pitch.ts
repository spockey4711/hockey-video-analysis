/**
 * `pitch.json`: the field hockey pitch in metres (ADR 0010), generated from
 * `src/features/tactics/pitch.ts`. The FIH numbers are the shared source; the
 * derived shapes (board, boundary, goals, broken line, markings) are golden
 * values a port of the drawing code checks itself against.
 */
import { DEFAULT_TOLERANCE } from "./vector";

import {
  BACK_MARK_DISTANCES,
  BOARD_BOUNDS,
  BOUNDARY,
  BROKEN_LINE_DASH,
  BROKEN_LINE_GAP,
  BROKEN_LINE_HALF_LENGTH,
  BROKEN_LINE_OFFSET,
  CENTRE,
  CIRCLE_RADIUS,
  CIRCLE_STRAIGHT,
  GOAL_DEPTH,
  GOAL_POST_WIDTH,
  GOAL_WIDTH,
  LINE_WIDTH,
  MARK_LENGTH,
  PENALTY_SPOT_DIAMETER,
  PENALTY_SPOT_DISTANCE,
  PITCH_LENGTH,
  PITCH_WIDTH,
  QUARTER_LINE_DISTANCE,
  RUN_OFF_ENDS,
  RUN_OFF_SIDES,
  SIDE_MARK_DISTANCE,
  brokenLineDashCentres,
  goalRects,
  pitchMarkings,
} from "@/features/tactics/pitch";

export function buildPitch() {
  return {
    contract: "pitch",
    description:
      "The pitch in metres: x along the side-lines from the outer edge of the left " +
      "back-line (0) to the right one (pitchLength), y along the back-lines from " +
      "the outer edge of the top side-line (0) to the bottom one (pitchWidth). " +
      "fih holds the FIH Rules of Hockey 2026 dimensions; the rest is derived from " +
      "them. Markings are line centres: SVG path data (M, L and A commands, " +
      "numbers rounded to 0.1 mm) or spots with a radius.",
    reference: ["src/features/tactics/pitch.ts"],
    tolerance: DEFAULT_TOLERANCE,
    fih: {
      pitchLength: PITCH_LENGTH,
      pitchWidth: PITCH_WIDTH,
      lineWidth: LINE_WIDTH,
      quarterLineDistance: QUARTER_LINE_DISTANCE,
      circleRadius: CIRCLE_RADIUS,
      circleStraight: CIRCLE_STRAIGHT,
      brokenLineOffset: BROKEN_LINE_OFFSET,
      brokenLineDash: BROKEN_LINE_DASH,
      brokenLineGap: BROKEN_LINE_GAP,
      goalWidth: GOAL_WIDTH,
      goalPostWidth: GOAL_POST_WIDTH,
      goalDepth: GOAL_DEPTH,
      penaltySpotDistance: PENALTY_SPOT_DISTANCE,
      penaltySpotDiameter: PENALTY_SPOT_DIAMETER,
      markLength: MARK_LENGTH,
      sideMarkDistance: SIDE_MARK_DISTANCE,
      backMarkDistances: [...BACK_MARK_DISTANCES],
      runOffEnds: RUN_OFF_ENDS,
      runOffSides: RUN_OFF_SIDES,
    },
    board: BOARD_BOUNDS,
    centre: CENTRE,
    boundary: BOUNDARY,
    goals: goalRects(),
    brokenLine: {
      halfLength: BROKEN_LINE_HALF_LENGTH,
      dashCentres: brokenLineDashCentres(),
    },
    markings: pitchMarkings(),
  };
}
