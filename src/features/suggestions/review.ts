/**
 * Pure mapping from a confirmed whistle candidate to the goal tag it commits
 * (P1-5, PRD 5.3). A double-whistle is the referee signalling a goal, so a
 * confirmed candidate becomes a `goal` tag placed at the candidate's timestamp
 * with the goal type's clip window (PRD 5.2), the team's where it set one. Candidates are never
 * auto-committed - spectator whistles cause false positives - so this only runs
 * once a coach confirms. Kept DB- and DOM-free so the window math is unit-tested
 * directly; the query layer persists what it returns.
 */
import { captureTag, type CapturedTag } from "@/features/tagging";
import {
  DEFAULT_TAG_WINDOWS,
  getTagType,
  withTagWindow,
  type TagTypeDef,
  type TagWindows,
} from "@/lib/tag-types";

/** The tag type a confirmed double-whistle candidate commits to. */
export const SUGGESTION_TAG_TYPE = "goal";

/**
 * The goal tag type, or a loud failure. `goal` is part of the frozen default
 * type set (PRD 5.2); a config edit that dropped it would silently break
 * confirming a suggestion, so this throws rather than commit a tag with an
 * unknown type.
 */
function goalType(): TagTypeDef {
  const type = getTagType(SUGGESTION_TAG_TYPE);
  if (!type) {
    throw new Error(
      `missing "${SUGGESTION_TAG_TYPE}" tag type for whistle suggestions`,
    );
  }
  return type;
}

/**
 * Resolve the goal tag window a confirmed candidate at global time `atS`
 * commits to, applying the goal type's lead-in/follow-through from `windows`
 * (the team's, else the default). `maxS` (total game duration) clamps the
 * window to the game bounds when known.
 */
export function goalTagFromCandidate(
  atS: number,
  opts?: { readonly maxS?: number; readonly windows?: TagWindows },
): CapturedTag {
  const windows = opts?.windows ?? DEFAULT_TAG_WINDOWS;
  return captureTag(withTagWindow(goalType(), windows), atS, {
    maxS: opts?.maxS,
  });
}
