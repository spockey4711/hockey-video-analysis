/**
 * Turning a tag's clip window into a concrete, per-file cut plan (P1-7, ADR
 * 0002/0004, PRD s3 risk 2).
 *
 * A clip window is a single global game-time interval, but a game is recorded as
 * N ordered chapter files, so a window may straddle a seam and span more than one
 * file. The cut-worker copies each source stream separately (ADR 0004), so it
 * needs to know exactly which files to cut, and from/to which local offset in
 * each - not a single clamped chapter. This module resolves the ordered
 * `game_sources` rows plus a `[startS, endS]` window into that plan, layering the
 * chapter file paths onto the pure segments from
 * {@link toSourceSegments}. It stays DB-free and pure so it is unit-tested
 * directly and reused verbatim as the app-side of the shared worker contract.
 *
 * Units: every value is seconds. Durations may be fractional.
 */
import { toSourceSegments } from "@/lib/time-mapping";

/**
 * One chapter of a game as the plan needs it: its order among the chapters, the
 * stored NAS file path to cut from, and its duration. Mirrors the relevant
 * `game_sources` columns (`order_index`, `file_path`, `duration_s`).
 */
export interface ClipSource {
  readonly orderIndex: number;
  readonly filePath: string;
  readonly durationS: number;
}

/**
 * One piece of a clip the worker cuts from a single chapter file: copy
 * `[localStartS, localEndS)` of `filePath`. `durationS` is the piece's length, a
 * convenience for the worker's `-t` argument and for surfacing clip length.
 */
export interface ClipSourceCut {
  readonly sourceIndex: number;
  readonly filePath: string;
  readonly localStartS: number;
  readonly localEndS: number;
  readonly durationS: number;
}

/**
 * The full recipe for one clip: the ordered per-file cuts to copy and
 * concatenate, the window they came from, the total clip length, and whether the
 * window crossed a seam (so a caller can flag or specially handle a
 * multi-file clip).
 */
export interface ClipCutPlan {
  readonly startS: number;
  readonly endS: number;
  readonly durationS: number;
  readonly spansBoundary: boolean;
  readonly cuts: readonly ClipSourceCut[];
}

/**
 * Order the given chapters by `orderIndex` and confirm they form the contiguous
 * `0..N-1` sequence the global-time mapping assumes; a gap or duplicate would
 * silently shift every downstream offset, so we fail loudly instead.
 */
function orderedChapters(sources: readonly ClipSource[]): ClipSource[] {
  if (sources.length === 0) {
    throw new RangeError("clip cut plan needs at least one source chapter");
  }
  const ordered = [...sources].sort((a, b) => a.orderIndex - b.orderIndex);
  for (let index = 0; index < ordered.length; index += 1) {
    if (ordered[index].orderIndex !== index) {
      throw new RangeError(
        `source chapters must be a contiguous 0..N-1 order; got order index ` +
          `${ordered[index].orderIndex} at position ${index}`,
      );
    }
  }
  return ordered;
}

/**
 * Resolve a game's ordered chapters and a global clip window `[startS, endS]`
 * into the per-file cut plan.
 *
 * The window is split across chapter boundaries with the shared half-open rule
 * (see {@link toSourceSegments}), so a boundary-crossing clip yields one cut per
 * file it touches - cleanly, rather than clamped at the seam. `spansBoundary`
 * reports whether that happened.
 *
 * @throws RangeError if the chapters are not a contiguous ordered layout, or the
 *   window is empty, reversed, non-finite, or outside `[0, total]`.
 */
export function planClipCut(
  sources: readonly ClipSource[],
  startS: number,
  endS: number,
): ClipCutPlan {
  const ordered = orderedChapters(sources);
  const durationsS = ordered.map((chapter) => chapter.durationS);
  const segments = toSourceSegments(durationsS, startS, endS);

  const cuts = segments.map((segment) => ({
    sourceIndex: segment.sourceIndex,
    filePath: ordered[segment.sourceIndex].filePath,
    localStartS: segment.localStartS,
    localEndS: segment.localEndS,
    durationS: segment.localEndS - segment.localStartS,
  }));

  return {
    startS,
    endS,
    durationS: endS - startS,
    spansBoundary: cuts.length > 1,
    cuts,
  };
}
