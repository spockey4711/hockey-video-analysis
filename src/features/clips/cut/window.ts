/**
 * Resolving a tag's persisted window into the interval the cutter copies.
 *
 * `tags.end_s` is nullable: a tag captured through the UI always carries an
 * explicit end (P0-6), but one posted without an end may not. The fallback is
 * the type's own `[start, start + postS]` rather than a fixed guess, read from
 * the same effective windows capture uses (the team's, Einstellungen >
 * Tag-Fenster, else the default in `@/lib/tag-types`), which the caller loads
 * and passes in - so the worker and the capture UI agree on one window.
 *
 * Units: seconds, fractional allowed (ADR 0002 global game time).
 */
import type { TagWindows } from "@/lib/tag-types";

/**
 * Window used when a tag has no explicit end and its type is unknown - an
 * ingested tag whose type was retired from the config, say. Long enough to hold
 * a hockey action, short enough that a wrong guess wastes little.
 */
export const FALLBACK_CLIP_WINDOW_S = 20;

/**
 * The global end offset to cut a tag to.
 *
 * Prefers the persisted `endS`. Falls back to the tag type's follow-through in
 * `windows` (`postS`), then to {@link FALLBACK_CLIP_WINDOW_S}, so a null end
 * never fails a cut.
 *
 * @throws RangeError if `startS` is not finite and non-negative, or a persisted
 *   `endS` does not lie after it - a window the cutter could not honor.
 */
export function resolveClipEnd(
  startS: number,
  endS: number | null,
  tagType: string,
  windows: TagWindows,
): number {
  if (!Number.isFinite(startS) || startS < 0) {
    throw new RangeError(`clip start ${startS}s is out of range`);
  }
  if (endS !== null) {
    if (!Number.isFinite(endS) || endS <= startS) {
      throw new RangeError(
        `clip end ${endS}s must lie after its start ${startS}s`,
      );
    }
    return endS;
  }
  const postS = Object.hasOwn(windows, tagType)
    ? windows[tagType].postS
    : undefined;
  return startS + (postS ?? FALLBACK_CLIP_WINDOW_S);
}
