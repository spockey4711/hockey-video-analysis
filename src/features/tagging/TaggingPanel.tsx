"use client";

/**
 * The editable tag list bound to the live tag store (P0-8). Capture now lives in
 * the transport bar ({@link TransportTagButtons}); this panel owns the read/edit
 * side - it renders {@link TagList} and drives the shared {@link useGameTags}
 * store so an inline edit or delete stays in sync with a fresh capture (and with
 * the jump markers) without a page reload. Runs inside the player context, so a
 * row can jump the timeline or stamp a clip window from the live game time.
 */
import { useCallback } from "react";

import { useGameTags } from "./GameTagsProvider";
import { TagList } from "./edit/TagList";
import type { EditableTag } from "./edit/queries";

import type { RosterPlayer } from "@/features/tag-players";

export interface TaggingPanelProps {
  /** The game whose moments are being tagged. */
  readonly gameId: string;
  /** Every selectable player, for the per-tag players/visibility picker (P0-7). */
  readonly roster?: readonly RosterPlayer[];
}

export function TaggingPanel({ roster = [] }: TaggingPanelProps) {
  const { tags, replaceTag, removeTag } = useGameTags();

  const handleEdited = useCallback(
    (edited: EditableTag) => replaceTag(edited),
    [replaceTag],
  );

  const handleDeleted = useCallback((id: string) => removeTag(id), [removeTag]);

  return (
    <TagList
      tags={tags}
      roster={roster}
      onEdited={handleEdited}
      onDeleted={handleDeleted}
    />
  );
}
