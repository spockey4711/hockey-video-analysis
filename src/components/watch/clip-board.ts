/**
 * Pure view logic for the watch page's clip board (P2-1). The board mounts a
 * coach-facing control that enqueues a cut from a tag and shows its cut status;
 * these helpers turn the flat clip list the API returns (`GET /api/clips?gameId=`)
 * into the per-tag view the panel renders, and answer the two questions the panel
 * asks: may a fresh cut be queued, and should the board keep polling. They hold no
 * React or request state so they can be unit-tested in isolation, and they reuse
 * the shared clip-status classifier rather than re-encoding the lifecycle.
 */
import {
  isActiveClipStatus,
  isClipStatus,
  type ClipStatus,
} from "@/features/clips/status";

/**
 * The slice of a clip the board needs. The API returns more (tag window, output
 * path, timestamps); the board only reads a clip's id, its tag, and its status.
 */
export interface ClipView {
  readonly id: string;
  readonly tagId: string;
  readonly status: ClipStatus;
}

/** Narrow an untrusted `/api/clips` row to the {@link ClipView} the board reads. */
export function toClipView(raw: unknown): ClipView | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.tagId !== "string" ||
    !isClipStatus(row.status)
  ) {
    return null;
  }
  return { id: row.id, tagId: row.tagId, status: row.status };
}

/**
 * Whether a clip is still moving through the cut pipeline. `pending` and
 * `processing` are the worker's in-flight states, so a board showing one must
 * keep polling to catch the transition to `ready`/`failed`; the terminal states
 * never need another fetch.
 */
export function isInFlightClip(status: ClipStatus): boolean {
  return status === "pending" || status === "processing";
}

/**
 * Reduce a game's clips to the current clip per tag. The API lists clips
 * newest-first, so the first clip seen for a tag id is its newest - a tag that
 * failed once and was re-cut shows the fresh attempt, not the stale failure.
 */
export function latestClipByTag(
  clips: readonly ClipView[],
): Map<string, ClipView> {
  const byTag = new Map<string, ClipView>();
  for (const clip of clips) {
    if (!byTag.has(clip.tagId)) {
      byTag.set(clip.tagId, clip);
    }
  }
  return byTag;
}

/**
 * Whether any tag still has a clip in flight, so the board should keep polling
 * for status changes. Returns `false` once every clip is `ready` or `failed`.
 */
export function hasInFlightClips(
  byTag: ReadonlyMap<string, ClipView>,
): boolean {
  for (const clip of byTag.values()) {
    if (isInFlightClip(clip.status)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a fresh cut can be queued for a tag given its current clip (if any). A
 * tag with no clip, or one whose only clip `failed`, can be (re)cut; a live clip
 * (`pending`/`processing`/`ready`) already covers the tag, so the enqueue would
 * only duplicate the worker's work - matching the server's idempotent guard.
 */
export function canEnqueueClip(current: ClipView | undefined): boolean {
  return current === undefined || !isActiveClipStatus(current.status);
}
