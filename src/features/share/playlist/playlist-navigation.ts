/**
 * Pure index math for the {@link PlaylistPlayer}. Kept out of the component so
 * the "what plays next" rules are unit-tested without a DOM. A playlist never
 * wraps: it is a coach-curated session that plays through once and stops on the
 * last clip, so the team can watch straight through without it looping back.
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
