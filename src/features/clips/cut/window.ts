/**
 * Resolving a tag's persisted window into the interval the cutter copies.
 *
 * `tags.end_s` is nullable: a tag captured through the UI always carries an
 * explicit end (P0-6), but an ingested or suggestion-derived one may not. The
 * per-type default window lives in `@/lib/tag-types`, so the fallback is the
 * type's own `[start, start + postS]` rather than a fixed guess - the worker and
 * the capture UI stay one config change apart.
 *
 * Units: seconds, fractional allowed (ADR 0002 global game time).
 */
import { getTagType } from "@/lib/tag-types";

/**
 * Window used when a tag has no explicit end and its type is unknown - an
 * ingested tag whose type was retired from the config, say. Long enough to hold
 * a hockey action, short enough that a wrong guess wastes little.
 */
export const FALLBACK_CLIP_WINDOW_S = 20;

/**
 * The global end offset to cut a tag to.
 *
 * Prefers the persisted `endS`. Falls back to the tag type's follow-through
 * (`window.postS`), then to {@link FALLBACK_CLIP_WINDOW_S}, so a null end never
 * fails a cut.
 *
 * @throws RangeError if `startS` is not finite and non-negative, or a persisted
 *   `endS` does not lie after it - a window the cutter could not honor.
 */
export function resolveClipEnd(
  startS: number,
  endS: number | null,
  tagType: string,
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
  const postS = getTagType(tagType)?.window.postS;
  return startS + (postS ?? FALLBACK_CLIP_WINDOW_S);
}
