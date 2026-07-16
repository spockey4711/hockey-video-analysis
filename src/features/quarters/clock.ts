/**
 * The game clock in quarter time (P1-4). A coach reads the match clock, not the
 * raw offset into the stitched recording: the clock starts at 0:00 when the first
 * quarter begins and reads 15:00 at the second quarter, 30:00 at the third and so
 * on, regardless of how much footage actually sits between the marked quarters.
 *
 * Pure and framework-free, so it is unit-testable and shared by every clock
 * readout (transport, video-frame corner, top bar). It maps a global game-time
 * offset (ADR 0002) onto the quarter clock; the formatting into `M:SS` stays with
 * the player's {@link formatGameClock}.
 */
import { quarterAt, type Quarter } from "./navigation";

/** Nominal length of one field-hockey quarter, in seconds (4 x 15 minutes). */
export const QUARTER_LENGTH_S = 15 * 60;

/**
 * Map a global game-time offset onto the quarter clock: inside quarter `i` the
 * clock reads `(i - 1) * 15:00` plus the time elapsed since that quarter's marked
 * start. Outside any quarter - before the first is marked, or in a break between
 * them - the raw game time runs on unchanged, so the readout never freezes.
 */
export function quarterClockS(
  quarters: readonly Quarter[],
  gameTimeS: number,
): number {
  const quarter = quarterAt(quarters, gameTimeS);
  if (!quarter) return gameTimeS;
  return (quarter.index - 1) * QUARTER_LENGTH_S + (gameTimeS - quarter.startS);
}
