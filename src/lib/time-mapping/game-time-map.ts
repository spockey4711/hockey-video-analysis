/**
 * Global game-time mapping (ADR 0002, PRD s3).
 *
 * A hockey game is recorded as N ordered chapter files (a GoPro splits a long
 * recording at ~4 GB). The whole system - player, cut-worker, whistle detector -
 * reasons in a single coordinate: the *global game-time offset*, in seconds since
 * the start of the game, independent of which chapter a moment falls in.
 *
 * This module is the one central, pure, DB-free conversion between that global
 * offset and a `(source file, local offset)` pair, computed from the ordered
 * chapter durations (`game_sources.duration_s`). It is the shared contract with
 * the pipeline worker; the same rules must hold on both sides, so the boundary
 * semantics below are deliberate and load-bearing.
 *
 * Units: every value is seconds. Durations may be fractional.
 */

/**
 * A point inside a specific chapter file: `localOffsetS` seconds into the file
 * at `sourceIndex` (0-based, following `game_sources.order_index`).
 */
export interface SourcePoint {
  readonly sourceIndex: number;
  readonly localOffsetS: number;
}

/**
 * Validates that `durationsS` is a usable ordered chapter layout: a non-empty
 * list of finite, strictly-positive durations. A zero or negative duration is a
 * corrupt `game_sources` row, not a boundary case, so we fail loudly.
 */
function assertValidDurations(
  durationsS: readonly number[],
): asserts durationsS is readonly number[] {
  if (durationsS.length === 0) {
    throw new RangeError("game-time map needs at least one chapter duration");
  }
  for (let i = 0; i < durationsS.length; i += 1) {
    const duration = durationsS[i];
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new RangeError(
        `chapter ${i} has a non-positive or non-finite duration (${duration}s)`,
      );
    }
  }
}

/**
 * Total length of the game in seconds: the sum of every chapter's duration.
 * Global offsets are valid in the closed interval `[0, totalDurationS]`.
 */
export function totalDurationS(durationsS: readonly number[]): number {
  assertValidDurations(durationsS);
  let total = 0;
  for (const duration of durationsS) {
    total += duration;
  }
  return total;
}

/**
 * Maps a global game-time offset to the chapter file that plays at that moment
 * and the local offset within it.
 *
 * Boundary rule (must match the pipeline worker): chapter intervals are
 * half-open `[start, start + duration)`, so an offset that lands exactly on an
 * interior boundary belongs to the *start* of the next chapter (local offset 0) -
 * that is where playback continues. The single exception is the game end: an
 * offset exactly equal to `totalDurationS` maps to the *end* of the last chapter
 * (`sourceIndex = N - 1`, `localOffsetS = last duration`), which is the natural
 * inverse for an exclusive clip end that reaches the final frame.
 *
 * @throws RangeError if `gameTimeS` is not finite or falls outside `[0, total]`.
 */
export function toSourcePoint(
  durationsS: readonly number[],
  gameTimeS: number,
): SourcePoint {
  assertValidDurations(durationsS);
  if (!Number.isFinite(gameTimeS) || gameTimeS < 0) {
    throw new RangeError(
      `game-time offset ${gameTimeS}s is out of range [0, total]`,
    );
  }

  let chapterStartS = 0;
  for (let index = 0; index < durationsS.length; index += 1) {
    const duration = durationsS[index];
    if (gameTimeS < chapterStartS + duration) {
      return { sourceIndex: index, localOffsetS: gameTimeS - chapterStartS };
    }
    chapterStartS += duration;
  }

  // Fell through the half-open scan: only the exact game end is still valid.
  if (gameTimeS === chapterStartS) {
    const lastIndex = durationsS.length - 1;
    return { sourceIndex: lastIndex, localOffsetS: durationsS[lastIndex] };
  }
  throw new RangeError(
    `game-time offset ${gameTimeS}s exceeds total ${chapterStartS}s`,
  );
}

/**
 * Maps a `(source file, local offset)` pair back to a global game-time offset:
 * the exact inverse of {@link toSourcePoint}. The local offset may equal the
 * chapter's duration (its exclusive end), which is how a boundary-crossing or
 * game-ending clip point is expressed.
 *
 * @throws RangeError if `sourceIndex` is not a valid chapter, or `localOffsetS`
 *   is not finite or falls outside `[0, chapter duration]`.
 */
export function toGameTime(
  durationsS: readonly number[],
  point: SourcePoint,
): number {
  assertValidDurations(durationsS);
  const { sourceIndex, localOffsetS } = point;
  if (!Number.isInteger(sourceIndex) || sourceIndex < 0) {
    throw new RangeError(`source index ${sourceIndex} is not a chapter`);
  }
  if (sourceIndex >= durationsS.length) {
    throw new RangeError(
      `source index ${sourceIndex} is out of range (${durationsS.length} chapters)`,
    );
  }
  const duration = durationsS[sourceIndex];
  if (!Number.isFinite(localOffsetS) || localOffsetS < 0) {
    throw new RangeError(
      `local offset ${localOffsetS}s is out of range [0, ${duration}]`,
    );
  }
  if (localOffsetS > duration) {
    throw new RangeError(
      `local offset ${localOffsetS}s exceeds chapter ${sourceIndex} duration ${duration}s`,
    );
  }

  let chapterStartS = 0;
  for (let index = 0; index < sourceIndex; index += 1) {
    chapterStartS += durationsS[index];
  }
  return chapterStartS + localOffsetS;
}
