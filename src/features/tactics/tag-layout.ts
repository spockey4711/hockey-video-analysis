/**
 * Where the tags under the discs go when they would run into each other. At a
 * short corner the keeper and four defenders stand 0.73 m apart in the goal,
 * closer than a name is wide, so a tag that would overlap one already placed
 * drops a row further down, as the screen shows it. Pure, so it is tested
 * without a board.
 */
import type { Turn } from "./geometry";
import type { PitchPoint } from "./pitch";

/** A tag to place: its token, where the token stands, and its text. */
export interface TagToPlace {
  readonly id: string;
  readonly at: PitchPoint;
  readonly text: string;
}

/**
 * A generous average glyph width in the app font, in ems, halo included; it
 * sizes a tag's box to its text (an SVG box cannot be measured before it is
 * drawn, and measuring would differ between the board and the picture).
 */
const CHAR_WIDTH = 0.62;
/** How far a row lies below the one above, in ems. */
export const TAG_ROW_HEIGHT = 1.1;
/** How much two boxes may touch, in ems, before they count as overlapping. */
const TOLERANCE = 0.1;

/**
 * A board point as the upright screen sees it: the board turned back by the
 * turn the labels undo (`rotate(90)` for a board turned left, `rotate(-90)`
 * for one turned right).
 */
export function uprightPoint(at: PitchPoint, turn: Turn): PitchPoint {
  if (turn === "left") return { x: at.y, y: -at.x };
  if (turn === "right") return { x: -at.y, y: at.x };
  return at;
}

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function overlaps(a: Box, b: Box, tolerance: number): boolean {
  return (
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > tolerance &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tolerance
  );
}

/**
 * The row each tag hangs in, by token id: 0 right under its disc, 1 a row
 * lower, and so on. Tags are placed top to bottom and left to right on
 * screen, each in the first row where it overlaps no tag placed before it.
 */
export function tagRows(
  tags: readonly TagToPlace[],
  turn: Turn,
  fontSize: number,
): ReadonlyMap<string, number> {
  const placed: Box[] = [];
  const rows = new Map<string, number>();
  const upright = tags
    .map((tag) => ({ ...tag, at: uprightPoint(tag.at, turn) }))
    .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);
  const step = fontSize * TAG_ROW_HEIGHT;
  const tolerance = fontSize * TOLERANCE;
  for (const tag of upright) {
    const half = ([...tag.text].length * CHAR_WIDTH * fontSize) / 2;
    const boxAt = (row: number): Box => ({
      left: tag.at.x - half,
      right: tag.at.x + half,
      top: tag.at.y + row * step,
      bottom: tag.at.y + row * step + fontSize,
    });
    let row = 0;
    while (placed.some((box) => overlaps(box, boxAt(row), tolerance))) row++;
    placed.push(boxAt(row));
    rows.set(tag.id, row);
  }
  return rows;
}
