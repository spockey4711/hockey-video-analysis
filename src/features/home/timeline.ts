/**
 * Data and pure geometry for the landing-page demo timeline (the hero
 * signature). Framework-free so the layout maths is unit-testable and the
 * `GameTimeline` client component stays a thin renderer, per the repo's "no
 * business logic in JSX" rule.
 */
import type { TagChipType } from "@/components/data/TagChip";

/** One tagged moment shown on the demo track. */
export interface DemoMarker {
  /** Position on the game clock, in seconds from kickoff. */
  readonly atS: number;
  /** Which tag type this marker codes (drives its colour and label). */
  readonly type: TagChipType;
}

/** The fictional game the hero timeline visualises. */
export interface DemoGame {
  /** Full game length in seconds - the track spans `0..totalS`. */
  readonly totalS: number;
  /** Number of equal chapters (field hockey plays four quarters). */
  readonly quarters: number;
  /** Tagged moments, in clock order. */
  readonly markers: readonly DemoMarker[];
}

/**
 * A representative 48-minute game with one of every marker type spread across
 * the four quarters, roughly in the order a coach would capture them live. The
 * times are illustrative, not real data.
 */
export const DEMO_GAME: DemoGame = {
  totalS: 48 * 60,
  quarters: 4,
  markers: [
    { atS: 6 * 60 + 20, type: "action_good" },
    { atS: 11 * 60 + 5, type: "corner_short" },
    { atS: 18 * 60 + 40, type: "goal" },
    { atS: 25 * 60 + 10, type: "whistle" },
    { atS: 33 * 60, type: "action_bad" },
    { atS: 42 * 60 + 30, type: "goal" },
  ],
} as const;

/**
 * Horizontal position of a clock time as a percentage (0..100) of the track
 * width. Clamped so an out-of-range time never escapes the track.
 */
export function markerLeftPercent(atS: number, totalS: number): number {
  if (totalS <= 0) return 0;
  const ratio = atS / totalS;
  return Math.min(100, Math.max(0, ratio * 100));
}

/**
 * The clock time (seconds) at each chapter boundary, tick marks included: for a
 * four-quarter game that is `[0, T/4, T/2, 3T/4, T]`. Used for the timecode
 * ruler and the segment dividers so both read from one source.
 */
export function quarterBoundariesS(game: DemoGame): number[] {
  const step = game.totalS / game.quarters;
  return Array.from({ length: game.quarters + 1 }, (_, i) =>
    Math.round(i * step),
  );
}
