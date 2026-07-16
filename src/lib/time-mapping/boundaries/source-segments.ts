/**
 * Splitting a global game-time window across chapter boundaries (ADR 0002, PRD
 * s3 risk 2).
 *
 * A tag's clip window `[startS, endS]` is expressed in the single global
 * game-time coordinate, so it may straddle the seam between two chapter files
 * (start in chapter i, end in chapter i+1). The cut-worker cannot copy a stream
 * across two physical files in one pass, so such a window has to be cut as one
 * segment per chapter it touches and the pieces concatenated - not clamped to
 * the chapter edge, which would silently drop the part of the clip that lives in
 * the next file.
 *
 * This is the pure, DB-free counterpart to {@link toSourcePoint} for an interval
 * rather than a point: given the ordered chapter durations and a global window,
 * it returns the ordered per-chapter segments the window covers. It shares the
 * half-open boundary rule of the point mapping, so a window ending exactly on a
 * seam stops at the end of the earlier chapter and does not spill a zero-length
 * segment into the next one. The same rules must hold on the pipeline worker.
 *
 * Units: every value is seconds. Durations may be fractional.
 */
import { totalDurationS } from "../game-time-map";

/**
 * A contiguous run of one chapter file that a global window covers: the interval
 * `[localStartS, localEndS)` within the chapter at `sourceIndex` (0-based,
 * following `game_sources.order_index`). `localEndS` may equal the chapter's
 * duration - its exclusive end - which is how a window reaching or crossing the
 * seam is expressed for that chapter.
 */
export interface SourceSegment {
  readonly sourceIndex: number;
  readonly localStartS: number;
  readonly localEndS: number;
}

/**
 * Split a global game-time window `[startS, endS]` into the ordered per-chapter
 * segments it covers.
 *
 * A window that fits inside one chapter yields a single segment; a window that
 * straddles one or more seams yields one segment per chapter it touches, in
 * chapter order, together forming the clip the worker copies and concatenates.
 * Chapters are half-open `[start, start + duration)`, matching
 * {@link toSourcePoint}: a window whose end lands exactly on an interior seam
 * ends at the earlier chapter's exclusive end and contributes nothing to the
 * next chapter, so no zero-length trailing segment is produced.
 *
 * @throws RangeError if the durations are not a valid layout, if either bound is
 *   not finite, if the window is not strictly ordered (`startS < endS`), or if it
 *   falls outside `[0, total]`.
 */
export function toSourceSegments(
  durationsS: readonly number[],
  startS: number,
  endS: number,
): SourceSegment[] {
  const total = totalDurationS(durationsS);
  if (!Number.isFinite(startS) || !Number.isFinite(endS)) {
    throw new RangeError(`clip window [${startS}, ${endS}] is not finite`);
  }
  if (startS < 0 || endS > total) {
    throw new RangeError(
      `clip window [${startS}, ${endS}] is out of range [0, ${total}]`,
    );
  }
  if (startS >= endS) {
    throw new RangeError(
      `clip window [${startS}, ${endS}] is empty or reversed`,
    );
  }

  const segments: SourceSegment[] = [];
  let chapterStartS = 0;
  for (let index = 0; index < durationsS.length; index += 1) {
    const chapterEndS = chapterStartS + durationsS[index];
    // Intersect the window with this chapter's half-open span; a positive
    // overlap becomes a segment, a mere touch at a seam (segEnd == segStart)
    // does not.
    const segStartS = Math.max(startS, chapterStartS);
    const segEndS = Math.min(endS, chapterEndS);
    if (segEndS > segStartS) {
      segments.push({
        sourceIndex: index,
        localStartS: segStartS - chapterStartS,
        localEndS: segEndS - chapterStartS,
      });
    }
    if (chapterEndS >= endS) break;
    chapterStartS = chapterEndS;
  }
  return segments;
}

/**
 * Whether a global game-time window straddles at least one chapter seam - i.e.
 * the worker must cut and concatenate more than one source file to produce it.
 * A convenience over {@link toSourceSegments} for callers that only need the flag
 * (e.g. flagging boundary-crossing clips in the coach's status board).
 */
export function windowCrossesBoundary(
  durationsS: readonly number[],
  startS: number,
  endS: number,
): boolean {
  return toSourceSegments(durationsS, startS, endS).length > 1;
}
