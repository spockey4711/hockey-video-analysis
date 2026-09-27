/**
 * The game clock in period time (P1-4). A coach reads the match clock, not the
 * raw offset into the stitched recording: the clock starts at 0:00 when the first
 * period begins and, in a 4 x 15 game, reads 15:00 at the second quarter, 30:00
 * at the third and so on, regardless of how much footage actually sits between
 * the marked periods.
 *
 * Pure and framework-free, so it is unit-testable and shared by every clock
 * readout (transport, video-frame corner, top bar). It maps a global game-time
 * offset (ADR 0002) onto the period clock; the formatting into `M:SS` stays with
 * the player's {@link formatGameClock}.
 */
import { quarterAt, type Quarter } from "./navigation";

/**
 * Map a global game-time offset onto the period clock: inside period `i` the
 * clock reads `(i - 1) * periodLengthS` plus the time elapsed since that
 * period's marked start. The length is the game's format (see
 * `resolveGameFormat`), never assumed here. Outside any period - before the
 * first is marked, or in a break between them - the raw game time runs on
 * unchanged, so the readout never freezes.
 */
export function quarterClockS(
  quarters: readonly Quarter[],
  gameTimeS: number,
  periodLengthS: number,
): number {
  const quarter = quarterAt(quarters, gameTimeS);
  if (!quarter) return gameTimeS;
  return (quarter.index - 1) * periodLengthS + (gameTimeS - quarter.startS);
}
