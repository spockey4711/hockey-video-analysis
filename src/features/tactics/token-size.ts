/**
 * How big the things on the board are drawn, in pitch metres, per view. The
 * whole pitch draws tokens large enough to read, not to scale. A short-corner
 * view draws them near to scale, so the keeper and four defenders stand side by
 * side in the 3.66 m goal mouth with a gap between each, as at a real corner.
 * Everything drawn around a token (the selection ring, a run's trail and bend
 * handle, a line's pen, a zone's edge and hatching, a text) shrinks with it;
 * what a finger has to hit stays larger than what is drawn.
 */
import type { PitchView } from "./pitch";

export interface BoardSizes {
  /** A player's disc radius. */
  readonly player: number;
  /** The ball's radius. */
  readonly ball: number;
  /** The dark edge round a disc. */
  readonly edge: number;
  /** How far the selection ring stands off a disc, and its width. */
  readonly ringGap: number;
  readonly ringWidth: number;
  /** The invisible circle round a token that catches a finger. */
  readonly hit: number;
  /** The handle that bends a run, and the circle that catches it. */
  readonly bend: number;
  readonly bendHit: number;
  /** The dashed trail a run leaves: its width and dash rhythms. */
  readonly trail: number;
  readonly trailDash: string;
  readonly trailRingDash: string;
  /** How much of the board pen a line is drawn with (see `boardPenWidth`). */
  readonly pen: number;
  /** A line's invisible hit stroke. */
  readonly lineHit: number;
  /** A zone's outline width. */
  readonly zoneEdge: number;
  /** How far apart a hatched zone's lines run, and their width. */
  readonly hatch: number;
  readonly hatchWidth: number;
  /** A text's font size, and the smallest it is drawn on screen in CSS pixels. */
  readonly text: number;
  readonly textMinPx: number;
  /**
   * The smallest a label is drawn on screen, in CSS pixels, or 0 for labels
   * that always fit their disc. A label grown past its disc gets a halo in
   * its team's colour, so it reads over the pitch and its neighbours.
   */
  readonly labelMinPx: number;
  /**
   * The tag under a player's disc (its position code and name): its font
   * size, the gap above it, and the smallest it is drawn on screen in CSS
   * pixels, so a name still reads on a phone and at a short corner.
   */
  readonly tag: number;
  readonly tagGap: number;
  readonly tagMinPx: number;
}

const FULL: BoardSizes = {
  player: 1.2,
  ball: 0.55,
  edge: 0.15,
  ringGap: 0.5,
  ringWidth: 0.3,
  hit: 2,
  bend: 0.7,
  bendHit: 0.7,
  trail: 0.2,
  trailDash: "0.6 0.5",
  trailRingDash: "0.5 0.4",
  pen: 1,
  lineHit: 2,
  zoneEdge: 0.25,
  hatch: 1.4,
  hatchWidth: 0.3,
  text: 2.2,
  textMinPx: 12,
  labelMinPx: 0,
  tag: 1.1,
  tagGap: 0.2,
  tagMinPx: 11,
};

/** The short-corner view draws a quarter of the whole pitch's sizes. */
const CORNER_SCALE = 0.25;

const CORNER: BoardSizes = {
  player: FULL.player * CORNER_SCALE,
  ball: FULL.ball * CORNER_SCALE,
  edge: FULL.edge * CORNER_SCALE,
  ringGap: FULL.ringGap * CORNER_SCALE,
  ringWidth: FULL.ringWidth * CORNER_SCALE,
  // Close to the gap between two defenders in the goal, so each still catches
  // a finger and the nearest one wins where they meet (see `BoardCanvas`).
  hit: 0.9,
  bend: 0.3,
  bendHit: 0.9,
  trail: 0.08,
  trailDash: "0.25 0.2",
  trailRingDash: "0.15 0.12",
  // Half the pen: the quarter shows about twice as large as the whole pitch,
  // so a line reads about as thick on screen in both views.
  pen: 0.5,
  lineHit: 1,
  zoneEdge: 0.1,
  hatch: 0.6,
  hatchWidth: 0.12,
  // Half the whole pitch's, like the pen.
  text: 1.1,
  textMinPx: 12,
  labelMinPx: 9,
  tag: FULL.tag * CORNER_SCALE,
  tagGap: FULL.tagGap * CORNER_SCALE,
  // A touch under the whole pitch's floor: the defenders in the goal stand
  // closer together than any names do on the whole pitch.
  tagMinPx: 10,
};

export function boardSizes(view: PitchView): BoardSizes {
  return view === "full" ? FULL : CORNER;
}

/**
 * A player label's font size in metres: what fits the disc (a number fills
 * it, a longer label runs smaller), and at least `labelMinPx` on screen at
 * `pxPerMetre` (0 while the board is not yet laid out).
 */
export function labelFontSize(
  label: string,
  sizes: BoardSizes,
  pxPerMetre: number,
): number {
  // The whole pitch's sizes: 1.3 m for a number, 0.95 m for a longer label.
  const fits =
    (sizes.player * ([...label].length > 2 ? 0.95 : 1.3)) / FULL.player;
  if (sizes.labelMinPx <= 0 || pxPerMetre <= 0) return fits;
  return Math.max(fits, sizes.labelMinPx / pxPerMetre);
}

/**
 * A text's font size in metres: the view's size, and at least `textMinPx` on
 * screen at `pxPerMetre` (0 while the board is not yet laid out), so it reads
 * on a phone too.
 */
export function textFontSize(sizes: BoardSizes, pxPerMetre: number): number {
  if (pxPerMetre <= 0) return sizes.text;
  return Math.max(sizes.text, sizes.textMinPx / pxPerMetre);
}

/**
 * The font size of the tag under a disc in metres: the view's own size, and
 * at least `tagMinPx` on screen at `pxPerMetre` (0 while the board is not yet
 * laid out).
 */
export function tagFontSize(sizes: BoardSizes, pxPerMetre: number): number {
  if (pxPerMetre <= 0) return sizes.tag;
  return Math.max(sizes.tag, sizes.tagMinPx / pxPerMetre);
}
