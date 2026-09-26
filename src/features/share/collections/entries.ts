/**
 * The play order of a collection with tactics scenes in it (ADR 0013), as pure
 * functions shared by the share link, presentation mode and the coach's
 * running order.
 *
 * Clips play chronologically - newest game first, then by game time - and
 * carry no order of their own. A scene entry is placed relative to them: right
 * after one clip (or before the first), and among the scenes at the same spot
 * by its position. The placement is compared by the clip's place in the play
 * order rather than by its presence, so a scene keeps its spot when the clip
 * it follows leaves the collection or is being re-cut.
 */

/** Where a clip sits in the play order: its game's date and its game time. */
export interface ClipOrderKey {
  /** The game's date (`YYYY-MM-DD`), or `null` for a game without one. */
  readonly playedOn: string | null;
  readonly startS: number;
}

/** A clip in the play order. */
export interface OrderedClip {
  readonly id: string;
  readonly key: ClipOrderKey;
}

/** A scene entry and where it is placed. */
export interface PlacedScene {
  readonly id: string;
  /** The key of the clip it follows, or `null` for before the first clip. */
  readonly after: ClipOrderKey | null;
  /** Its order among the scenes at the same spot, lowest first. */
  readonly position: number;
}

/** One entry of the play order. */
export type OrderedEntry<C, S> =
  | { readonly kind: "clip"; readonly clip: C }
  | { readonly kind: "scene"; readonly scene: S };

/** A scene's stored placement: the clip it follows and its order there. */
export interface ScenePlacement {
  readonly id: string;
  readonly afterClipId: string | null;
  readonly position: number;
}

/**
 * Compare two clips by play order, the way the clip queries sort them: the
 * newer game first (a game without a date first of all, as Postgres sorts
 * nulls first when descending), then the earlier game time.
 */
export function compareClipKeys(a: ClipOrderKey, b: ClipOrderKey): number {
  if (a.playedOn !== b.playedOn) {
    if (a.playedOn === null) return -1;
    if (b.playedOn === null) return 1;
    return a.playedOn < b.playedOn ? 1 : -1;
  }
  return a.startS - b.startS;
}

function compareScenes(a: PlacedScene, b: PlacedScene): number {
  if (a.after === null || b.after === null) {
    if (a.after !== b.after) return a.after === null ? -1 : 1;
  } else {
    const byClip = compareClipKeys(a.after, b.after);
    if (byClip !== 0) return byClip;
  }
  return a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Merge the clips, already in play order, with the scene entries: each scene
 * comes after every clip at or before the clip it follows, and before the
 * next one. A scene that follows a clip past the last one comes at the end.
 */
export function mergeEntries<C extends OrderedClip, S extends PlacedScene>(
  clips: readonly C[],
  scenes: readonly S[],
): OrderedEntry<C, S>[] {
  const pending = [...scenes].sort(compareScenes);
  const entries: OrderedEntry<C, S>[] = [];
  let next = 0;
  for (const clip of clips) {
    while (next < pending.length) {
      const scene = pending[next] as S;
      if (scene.after !== null && compareClipKeys(scene.after, clip.key) >= 0)
        break;
      entries.push({ kind: "scene", scene });
      next += 1;
    }
    entries.push({ kind: "clip", clip });
  }
  for (const scene of pending.slice(next))
    entries.push({ kind: "scene", scene });
  return entries;
}

/**
 * The placement every scene gets from its spot in a play order: after the
 * clip before it (or before the first clip), numbered from 0 among the
 * scenes there.
 */
export function placementsOf<C extends OrderedClip, S extends { id: string }>(
  entries: readonly OrderedEntry<C, S>[],
): ScenePlacement[] {
  const placements: ScenePlacement[] = [];
  let afterClipId: string | null = null;
  let position = 0;
  for (const entry of entries) {
    if (entry.kind === "clip") {
      afterClipId = entry.clip.id;
      position = 0;
    } else {
      placements.push({ id: entry.scene.id, afterClipId, position });
      position += 1;
    }
  }
  return placements;
}

/** Which way a scene moves in the play order. */
export type MoveDirection = "up" | "down";

/**
 * The play order with one scene swapped with its neighbour, or `null` when it
 * cannot move that way (already first or last, or not in the order).
 */
export function moveScene<C extends OrderedClip, S extends { id: string }>(
  entries: readonly OrderedEntry<C, S>[],
  sceneId: string,
  direction: MoveDirection,
): OrderedEntry<C, S>[] | null {
  const from = entries.findIndex(
    (entry) => entry.kind === "scene" && entry.scene.id === sceneId,
  );
  if (from === -1) return null;
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= entries.length) return null;
  const moved = [...entries];
  [moved[from], moved[to]] = [moved[to], moved[from]] as [
    OrderedEntry<C, S>,
    OrderedEntry<C, S>,
  ];
  return moved;
}
