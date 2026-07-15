/**
 * Placement of each chapter on the continuous game timeline, as fractions of the
 * total game length. The timeline draws one lane per chapter (V1..Vn) so a coach
 * can see chapter boundaries while scrubbing across the whole game (ADR 0002).
 * Pure and duration-only, so it is trivially testable and shared by the timeline
 * and its test.
 */

export interface ChapterLane {
  /** 1-based lane label, e.g. `V2`. */
  readonly label: string;
  /** Left edge as a fraction of the total game length, in `[0, 1]`. */
  readonly startFraction: number;
  /** Width as a fraction of the total game length, in `[0, 1]`. */
  readonly widthFraction: number;
}

/**
 * Map ordered chapter durations to their lanes on the game timeline. Returns an
 * empty list when the total length is not positive (nothing to place yet), so
 * callers can render nothing without a divide-by-zero guard of their own.
 */
export function chapterLanes(durationsS: readonly number[]): ChapterLane[] {
  const total = durationsS.reduce(
    (sum, d) => sum + (Number.isFinite(d) && d > 0 ? d : 0),
    0,
  );
  if (!(total > 0)) return [];

  let elapsed = 0;
  return durationsS.map((duration, index) => {
    const width = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const startFraction = elapsed / total;
    elapsed += width;
    return {
      label: `V${index + 1}`,
      startFraction,
      widthFraction: width / total,
    };
  });
}
