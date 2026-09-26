/**
 * The collection page's running order (ADR 0014): the clips the link plays
 * with the scene entries placed between them, as display-ready rows for the
 * coach to arrange. Pure and server-safe, like the curation checklist mapper.
 */
import { collectionsContent } from "./content";
import type { CurationItem } from "./curation-items";
import { mergeEntries } from "./entries";
import type { SceneEntryRow } from "./scene-entries";

import { sceneDuration } from "@/features/tactics/animation";

/** One row of the running order. */
export type RunningOrderRow =
  | {
      readonly kind: "clip";
      readonly id: string;
      readonly title: string;
      readonly subtitle: string;
    }
  | {
      readonly kind: "scene";
      /** The entry's id, which the scene actions take. */
      readonly id: string;
      readonly name: string;
      /** "Standbild", or the animation's length. */
      readonly detail: string;
      /** A still scene has a hold time to set; an animated one runs its length. */
      readonly still: boolean;
      readonly holdS: number;
    };

/**
 * Merge the member clips (ready, in play order) with the scene entries into
 * the rows the coach sees, in the order the link plays them.
 */
export function toRunningOrder(
  members: readonly CurationItem[],
  scenes: readonly SceneEntryRow[],
): RunningOrderRow[] {
  const { scenes: copy } = collectionsContent.coach.detail;
  return mergeEntries(members, scenes).map((entry) => {
    if (entry.kind === "clip") {
      const { id, title, subtitle } = entry.clip;
      return { kind: "clip", id, title, subtitle };
    }
    const { id, name, scene, holdS } = entry.scene;
    const seconds = sceneDuration(scene);
    return {
      kind: "scene",
      id,
      name,
      detail: seconds > 0 ? copy.animated(seconds) : copy.still,
      still: seconds === 0,
      holdS,
    };
  });
}
