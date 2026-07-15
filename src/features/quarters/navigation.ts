/**
 * Pure quarter navigation and clip math (P1-4, PRD 5.3) - no DB, no framework,
 * so it is unit-testable and shared by the API, the timeline overlay, and the
 * per-quarter clip flow.
 *
 * A quarter is a manually set span on the global game timeline (ADR 0002): every
 * offset here is a global game-time offset in seconds, never a file-local one.
 * A quarter's `endS` is optional - a coach may mark only the start - so the
 * effective end is resolved from the next quarter's start, or the game end, when
 * it is absent. Intervals are half-open `[startS, endS)` to match the game-time
 * boundary rule: an offset exactly on a boundary belongs to the *next* span.
 */

/** A quarter span on the global game timeline; `index` is the number (1..4). */
export interface Quarter {
  readonly index: number;
  readonly startS: number;
  /** Explicit end, or `null` when only the start has been marked. */
  readonly endS: number | null;
}

/** A quarter's span as fractions of the whole game, for timeline bands (0..1). */
export interface QuarterBand {
  readonly index: number;
  readonly startFraction: number;
  readonly endFraction: number;
}

/** A concrete clip window `[startS, endS]` in global game time. */
export interface QuarterWindow {
  readonly startS: number;
  readonly endS: number;
}

/** Return a copy of `quarters` ordered by `index`, so callers pass any order. */
function byIndex(quarters: readonly Quarter[]): Quarter[] {
  return [...quarters].sort((a, b) => a.index - b.index);
}

/**
 * The effective end of quarter `i` in an index-sorted list: its explicit `endS`
 * if set, otherwise the next quarter's start, otherwise `fallbackS` (the game
 * end, or `Infinity` when the total is unknown).
 */
function effectiveEndS(
  sorted: readonly Quarter[],
  i: number,
  fallbackS: number,
): number {
  const explicit = sorted[i].endS;
  if (explicit !== null) return explicit;
  const next = sorted[i + 1];
  return next ? next.startS : fallbackS;
}

/**
 * The quarter containing `gameTimeS`, or `null` when the offset falls in a break
 * between quarters or before the first / after the last. The end is resolved
 * from the next quarter's start when a quarter has no explicit `endS`, so an
 * open-ended final quarter still matches every later offset.
 */
export function quarterAt(
  quarters: readonly Quarter[],
  gameTimeS: number,
): Quarter | null {
  if (!Number.isFinite(gameTimeS)) return null;
  const sorted = byIndex(quarters);
  for (let i = 0; i < sorted.length; i += 1) {
    const quarter = sorted[i];
    if (gameTimeS < quarter.startS) continue;
    if (gameTimeS < effectiveEndS(sorted, i, Infinity)) return quarter;
  }
  return null;
}

/**
 * The concrete clip window for a quarter, for per-quarter clip creation: the
 * quarter's start to its effective end (explicit `endS`, else the next
 * quarter's start, else `totalDurationS`). Returns `null` when no quarter has
 * that index. The end is clamped to `totalDurationS` so an out-of-range boundary
 * never produces a clip past the game.
 */
export function quarterWindow(
  quarters: readonly Quarter[],
  index: number,
  totalDurationS: number,
): QuarterWindow | null {
  const sorted = byIndex(quarters);
  const i = sorted.findIndex((quarter) => quarter.index === index);
  if (i < 0) return null;
  const startS = Math.max(0, Math.min(sorted[i].startS, totalDurationS));
  const endS = Math.min(
    effectiveEndS(sorted, i, totalDurationS),
    totalDurationS,
  );
  return { startS, endS: Math.max(startS, endS) };
}

/**
 * Quarter spans as fractions of the whole game, for rendering timeline bands.
 * Each fraction is clamped to `[0, 1]`; an empty list or a non-positive total
 * yields no bands (there is nothing to lay out on).
 */
export function quarterBands(
  quarters: readonly Quarter[],
  totalDurationS: number,
): QuarterBand[] {
  if (!(totalDurationS > 0)) return [];
  const sorted = byIndex(quarters);
  return sorted.map((quarter, i) => ({
    index: quarter.index,
    startFraction: clampFraction(quarter.startS / totalDurationS),
    endFraction: clampFraction(
      effectiveEndS(sorted, i, totalDurationS) / totalDurationS,
    ),
  }));
}

/** Clamp a raw fraction to `[0, 1]`, mapping a non-finite value to 0. */
function clampFraction(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(Math.max(fraction, 0), 1);
}
