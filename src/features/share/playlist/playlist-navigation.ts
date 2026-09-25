/**
 * Pure index math for the {@link PlaylistPlayer}. Kept out of the component so
 * the "what plays next" rules are unit-tested without a DOM. A playlist never
 * wraps: it is a coach-curated session that stops on the last clip rather than
 * looping back. Whether it plays through on its own is the {@link PlaybackMode}.
 */

/** Clamp an index into a list of `length` items (empty list clamps to 0). */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return 0;
  if (index > length - 1) return length - 1;
  return index;
}

/** The next index, stopping at the last item (no wrap-around). */
export function nextIndex(current: number, length: number): number {
  return clampIndex(current + 1, length);
}

/** The previous index, stopping at the first item (no wrap-around). */
export function prevIndex(current: number, length: number): number {
  return clampIndex(current - 1, length);
}

/** Whether `current` is the last item, i.e. auto-advance should stop. */
export function isLast(current: number, length: number): boolean {
  return current >= length - 1;
}

/**
 * How a playlist moves through its clips.
 *
 * - `continuous`: selecting a clip starts it, and a finished clip hands over to
 *   the next one until the last clip (the team and per-player links).
 * - `manual`: nothing plays or advances on its own. A selected clip loads
 *   paused, a finished clip stops on its last frame, and the viewer chooses to
 *   replay it or move on (the collection link).
 */
export type PlaybackMode = "continuous" | "manual";

/** Whether switching to a clip should start it without a further play press. */
export function playsOnSelect(mode: PlaybackMode): boolean {
  return mode === "continuous";
}

/**
 * The index to move to when the clip at `current` ends, or `null` to stay on
 * it: `manual` always stays, `continuous` advances until the last clip.
 */
export function indexAfterEnd(
  mode: PlaybackMode,
  current: number,
  length: number,
): number | null {
  if (mode === "manual" || isLast(current, length)) return null;
  return nextIndex(current, length);
}
