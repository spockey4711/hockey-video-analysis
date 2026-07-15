import type { HotkeyGroup } from "./HotkeyHints";
import { watchContent } from "./content";

import { TAG_TYPES } from "@/lib/tag-types";

/**
 * Build the watch-page hotkey reference (UX-6) from the single sources of
 * truth: the tag-type config for capture keys and the player's native timeline
 * navigation. Keeping the mapping here (not inline in the page) makes it
 * testable and keeps the tag keys/labels in lockstep with the tagging leaf,
 * which reads the same config.
 */
export function buildWatchHotkeyGroups(): readonly HotkeyGroup[] {
  const { groups, playPause, seek, step, speed } = watchContent.hotkeys;

  return [
    {
      title: groups.tagging,
      hints: TAG_TYPES.map((type) => ({
        keys: [type.hotkey.toUpperCase()],
        label: type.label,
      })),
    },
    {
      title: groups.timeline,
      hints: [
        { keys: ["Leer"], label: playPause },
        { keys: ["←", "→"], label: seek },
        { keys: ["⇧←", "⇧→"], label: step },
        { keys: ["↑", "↓"], label: speed },
      ],
    },
  ];
}
