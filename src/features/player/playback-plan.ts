/**
 * Pure playback transitions for the single-`<video>` continuous player.
 *
 * The player shows N chapter files through one `<video>` element by swapping its
 * `src` at chapter boundaries, while the coach only ever sees one continuous
 * game-time coordinate (ADR 0002). Deciding *where* a game time lands and
 * *whether* that requires loading a different chapter than the one on screen is
 * the load-bearing logic, so it lives here as pure functions over the ordered
 * chapter durations - no DOM, fully unit-tested - with the DOM wiring left to
 * the hook.
 */
import { toSourcePoint, totalDurationS } from "@/lib/time-mapping";
import type { SourcePoint } from "@/lib/time-mapping";

/**
 * A resolved seek: the chapter and local offset to position the `<video>` at,
 * plus whether that chapter differs from the one currently loaded (so the caller
 * knows to swap `src` before setting `currentTime`, rather than seek in place).
 */
export interface SeekTarget extends SourcePoint {
  readonly switchSource: boolean;
}

/**
 * Clamp a requested game time into the valid closed interval `[0, total]`. A
 * scrub past either end (keyboard, drag, a skip-forward near the final whistle)
 * is a normal gesture, not an error, so we saturate rather than throw.
 */
export function clampGameTimeS(
  durationsS: readonly number[],
  gameTimeS: number,
): number {
  const total = totalDurationS(durationsS);
  if (!Number.isFinite(gameTimeS) || gameTimeS < 0) return 0;
  if (gameTimeS > total) return total;
  return gameTimeS;
}

/**
 * Resolve a (possibly out-of-range) game time into a concrete seek relative to
 * the chapter currently loaded (`activeSourceIndex`). The time is clamped first,
 * then mapped to its `(chapter, local offset)` pair; `switchSource` is true when
 * that chapter is not the one already on screen.
 */
export function planSeek(
  durationsS: readonly number[],
  activeSourceIndex: number,
  gameTimeS: number,
): SeekTarget {
  const clamped = clampGameTimeS(durationsS, gameTimeS);
  const point = toSourcePoint(durationsS, clamped);
  return {
    ...point,
    switchSource: point.sourceIndex !== activeSourceIndex,
  };
}

/**
 * The chapter to continue with when the active one reaches its end, or `null`
 * when the last chapter has finished (the game is over). Playback of the next
 * chapter always resumes from local offset 0.
 */
export function nextChapterIndex(
  chapterCount: number,
  activeSourceIndex: number,
): number | null {
  const next = activeSourceIndex + 1;
  return next < chapterCount ? next : null;
}
