/**
 * The field hockey pitch, to scale, in metres. Every number comes from the FIH
 * Rules of Hockey (effective 1 March 2026), "Field and Equipment
 * Specifications", rules 1.1 to 1.5 and the "Field Dimensions" table:
 * https://www.fih.hockey/static-assets/pdf/fih-Rules-of-hockey-2026-final.pdf
 *
 * Pitch coordinates (ADR 0010): `x` runs along the side-lines from the outer
 * edge of the left back-line (0) to the outer edge of the right one (91.40),
 * `y` runs along the back-lines from the outer edge of the top side-line (0) to
 * the outer edge of the bottom one (55.00). The FIH measures most markings to a
 * line's outer or further edge; the markings below are the line centres worked
 * out from those edges, so the drawing lands where the paint is.
 */

/** Rule 1.1: the field of play is 91.40 m long and 55.00 m wide. */
export const PITCH_LENGTH = 91.4;
export const PITCH_WIDTH = 55;

/** Rule 1.2 b: every line is 75 mm wide, and part of the area it bounds. */
export const LINE_WIDTH = 0.075;

/** Rule 1.3 e: the 23 m lines, 22.90 m from each back-line to their far edge. */
export const QUARTER_LINE_DISTANCE = 22.9;

/**
 * Rule 1.4 a-b: the circle is a 3.66 m straight line 14.63 m out from the
 * back-line (outer edge to outer edge), continued by quarter circles centred
 * on the inside front corner of the nearer goal-post.
 */
export const CIRCLE_RADIUS = 14.63;
export const CIRCLE_STRAIGHT = 3.66;

/**
 * Rule 1.4 d: the broken line, its outer edge 5 m outside the circle-line,
 * made of 300 mm solid sections with 3 m gaps, starting with a solid section
 * at the top centre.
 */
export const BROKEN_LINE_OFFSET = 5;
export const BROKEN_LINE_DASH = 0.3;
export const BROKEN_LINE_GAP = 3;

/** Rule 1.5 d: 3.66 m between the inner edges of the goal-posts. */
export const GOAL_WIDTH = 3.66;
/** Rule 1.5 b: posts are 50 mm wide. */
export const GOAL_POST_WIDTH = 0.05;
/** Rule 1.5 e: the goal is at least 1.20 m deep at ground level. */
export const GOAL_DEPTH = 1.2;

/**
 * Rule 1.3 i: a 150 mm penalty spot in front of each goal, its centre 6.475 m
 * from the outer edge of the goal-line.
 */
export const PENALTY_SPOT_DISTANCE = 6.475;
export const PENALTY_SPOT_DIAMETER = 0.15;

/** Rule 1.3 f-g: the short marks outside the field are 300 mm long. */
export const MARK_LENGTH = 0.3;
/**
 * Rule 1.3 f: a mark outside each side-line, its further edge 14.63 m from
 * the outer edge of the back-line.
 */
export const SIDE_MARK_DISTANCE = 14.63;
/**
 * Rule 1.3 g: marks outside each back-line on both sides of the goal, 5 m and
 * 10 m from the outer edge of the nearer goal-post to their further edge.
 */
export const BACK_MARK_DISTANCES = [5, 10] as const;

/**
 * Rule 1.1: the run-off around the field, at least 3 m behind the back-lines
 * and 2 m beside the side-lines. The board reaches this far, so a player can
 * stand behind the back-line at a penalty corner or wait at the side-line.
 */
export const RUN_OFF_ENDS = 3;
export const RUN_OFF_SIDES = 2;

/** A point on the pitch, in metres (see the coordinate note above). */
export interface PitchPoint {
  readonly x: number;
  readonly y: number;
}

/** The whole board: the field plus its run-off, in pitch metres. */
export const BOARD_BOUNDS = {
  minX: -RUN_OFF_ENDS,
  minY: -RUN_OFF_SIDES,
  maxX: PITCH_LENGTH + RUN_OFF_ENDS,
  maxY: PITCH_WIDTH + RUN_OFF_SIDES,
} as const;

/** The middle of the field: the centre spot on the centre-line. */
export const CENTRE: PitchPoint = { x: PITCH_LENGTH / 2, y: PITCH_WIDTH / 2 };

/** One painted marking as a stroke along its centre line, in pitch metres. */
export type Marking =
  | { readonly kind: "path"; readonly d: string }
  | { readonly kind: "spot"; readonly at: PitchPoint; readonly r: number };

const HALF_LINE = LINE_WIDTH / 2;

/** Round to a tenth of a millimetre, so path strings stay short and stable. */
function mm(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function line(from: PitchPoint, to: PitchPoint): Marking {
  return {
    kind: "path",
    d: `M${mm(from.x)} ${mm(from.y)}L${mm(to.x)} ${mm(to.y)}`,
  };
}

/** Which way into the field an end's markings face: +1 from the left, -1 from the right. */
type End = 1 | -1;

/** The `x` of a point `distance` metres into the field from an end's back-line. */
function fromEnd(end: End, distance: number): number {
  return end === 1 ? distance : PITCH_LENGTH - distance;
}

/**
 * The centre line of a circle-shaped marking `radius` metres out (to its outer
 * edge) from an end: a quarter circle round the far post, the straight part
 * across the goal, and a quarter circle round the near post.
 */
function circlePath(end: End, outerRadius: number): string {
  const r = outerRadius - HALF_LINE;
  const top = CENTRE.y - CIRCLE_STRAIGHT / 2;
  const bottom = CENTRE.y + CIRCLE_STRAIGHT / 2;
  const x0 = fromEnd(end, 0);
  const x = fromEnd(end, r);
  // Sweep flag 1 runs clockwise on screen: from the top side round to the front
  // at the left end, and the other way round at the right end.
  const sweep = end === 1 ? 1 : 0;
  return [
    `M${mm(x0)} ${mm(top - r)}`,
    `A${mm(r)} ${mm(r)} 0 0 ${sweep} ${mm(x)} ${mm(top)}`,
    `L${mm(x)} ${mm(bottom)}`,
    `A${mm(r)} ${mm(r)} 0 0 ${sweep} ${mm(x0)} ${mm(bottom + r)}`,
  ].join("");
}

/**
 * A point on the broken line of an end, `s` metres along it from the top
 * centre towards the bottom (positive `s`) or the top (negative `s`).
 */
export function brokenLinePoint(end: End, s: number): PitchPoint {
  const r = CIRCLE_RADIUS + BROKEN_LINE_OFFSET - HALF_LINE;
  const half = CIRCLE_STRAIGHT / 2;
  const side = Math.sign(s) || 1;
  const along = Math.abs(s);
  if (along <= half) return { x: fromEnd(end, r), y: CENTRE.y + s };
  const angle = (along - half) / r;
  return {
    x: fromEnd(end, r * Math.cos(angle)),
    y: CENTRE.y + side * (half + r * Math.sin(angle)),
  };
}

/** Length of the broken line from its top centre to the back-line, one way. */
export const BROKEN_LINE_HALF_LENGTH =
  CIRCLE_STRAIGHT / 2 +
  ((CIRCLE_RADIUS + BROKEN_LINE_OFFSET - HALF_LINE) * Math.PI) / 2;

/**
 * The centres (as distances along the line from its top centre) of the solid
 * sections of a broken line: one on the top centre, then one every dash plus
 * gap in both directions, as long as the whole section stays on the field.
 */
export function brokenLineDashCentres(): number[] {
  const step = BROKEN_LINE_DASH + BROKEN_LINE_GAP;
  const centres = [0];
  for (
    let s = step;
    s + BROKEN_LINE_DASH / 2 <= BROKEN_LINE_HALF_LENGTH;
    s += step
  ) {
    centres.push(s, -s);
  }
  return centres.sort((a, b) => a - b);
}

function endMarkings(end: End): Marking[] {
  const markings: Marking[] = [];
  const quarter = fromEnd(end, QUARTER_LINE_DISTANCE - HALF_LINE);
  markings.push(line({ x: quarter, y: 0 }, { x: quarter, y: PITCH_WIDTH }));
  markings.push({ kind: "path", d: circlePath(end, CIRCLE_RADIUS) });

  for (const s of brokenLineDashCentres()) {
    const from = brokenLinePoint(end, s - BROKEN_LINE_DASH / 2);
    const to = brokenLinePoint(end, s + BROKEN_LINE_DASH / 2);
    markings.push(line(from, to));
  }

  markings.push({
    kind: "spot",
    at: { x: fromEnd(end, PENALTY_SPOT_DISTANCE), y: CENTRE.y },
    r: PENALTY_SPOT_DIAMETER / 2,
  });

  // Marks outside the back-line, 5 m and 10 m from the outer edge of each post.
  const postOuter = GOAL_WIDTH / 2 + GOAL_POST_WIDTH;
  const behind = fromEnd(end, -MARK_LENGTH);
  const onLine = fromEnd(end, 0);
  for (const distance of BACK_MARK_DISTANCES) {
    const offset = postOuter + distance - HALF_LINE;
    for (const y of [CENTRE.y - offset, CENTRE.y + offset]) {
      markings.push(line({ x: onLine, y }, { x: behind, y }));
    }
  }

  // Marks outside each side-line, 14.63 m from the back-line to their further edge.
  const side = fromEnd(end, SIDE_MARK_DISTANCE - HALF_LINE);
  markings.push(line({ x: side, y: 0 }, { x: side, y: -MARK_LENGTH }));
  markings.push(
    line(
      { x: side, y: PITCH_WIDTH },
      { x: side, y: PITCH_WIDTH + MARK_LENGTH },
    ),
  );
  return markings;
}

/**
 * Every white marking on the pitch except the outer boundary (drawn as its own
 * rectangle): the centre-line, and for each end the 23 m line, the circle, the
 * broken line, the penalty spot and the short marks outside the field.
 */
export function pitchMarkings(): Marking[] {
  return [
    line({ x: CENTRE.x, y: 0 }, { x: CENTRE.x, y: PITCH_WIDTH }),
    { kind: "spot", at: CENTRE, r: PENALTY_SPOT_DIAMETER / 2 },
    ...endMarkings(1),
    ...endMarkings(-1),
  ];
}

/** The outer boundary's centre line: side-lines and back-lines. */
export const BOUNDARY = {
  x: HALF_LINE,
  y: HALF_LINE,
  width: PITCH_LENGTH - LINE_WIDTH,
  height: PITCH_WIDTH - LINE_WIDTH,
} as const;

/** Each goal: the netted box behind the goal-line, outer post edges included. */
export function goalRects(): { x: number; y: number; w: number; h: number }[] {
  const h = GOAL_WIDTH + 2 * GOAL_POST_WIDTH;
  const y = CENTRE.y - h / 2;
  return [
    { x: -GOAL_DEPTH, y, w: GOAL_DEPTH, h },
    { x: PITCH_LENGTH, y, w: GOAL_DEPTH, h },
  ];
}

/** A rectangle of the board in pitch metres. */
export interface PitchBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * How much of the pitch a scene shows: the whole board, or the short-corner
 * quarter. There is one quarter, at the left goal: the pitch is the same turned
 * end to end, so the other goal would show nothing new.
 */
export type PitchView = "full" | "corner";
export const PITCH_VIEWS: readonly PitchView[] = ["full", "corner"];

/**
 * How deep a short-corner view reaches into the field from its back-line: the
 * 23 m area (rule 1.3 e) and one metre of turf past the 23 m line, so the line
 * reads as a line and not as the edge of the picture.
 */
export const CORNER_VIEW_DEPTH = QUARTER_LINE_DISTANCE + 1;

/**
 * The part of the board a view shows. A short-corner view is one quarter of
 * the field: the whole width between the side-lines (with their run-off, for
 * the side marks) and from the run-off behind the back-line (the goal, the
 * injection marks and the injector) to just past the 23 m line. That holds
 * the circle, the 5 m broken line and the penalty spot.
 */
export function viewBounds(view: PitchView): PitchBounds {
  if (view === "full") return BOARD_BOUNDS;
  return {
    minX: mm(fromEnd(1, -RUN_OFF_ENDS)),
    minY: BOARD_BOUNDS.minY,
    maxX: mm(fromEnd(1, CORNER_VIEW_DEPTH)),
    maxY: BOARD_BOUNDS.maxY,
  };
}
