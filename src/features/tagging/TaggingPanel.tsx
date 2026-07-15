"use client";

/**
 * Connects the watch player to the hotkey-tagging leaf (P0-6) and the editable
 * tag list (P0-8). The watch page mounts this into the player's `sidebar` slot,
 * where it runs inside the player's context and reads the live controller. It
 * forwards frame-current game time (`getGameTimeS`) and the total game length to
 * {@link HotkeyTagger}, keeping that leaf decoupled from how the player tracks
 * time, and drives the shared {@link useGameTags} store so a fresh hotkey capture
 * and an inline edit or delete in {@link TagList} stay in sync - and reflect in
 * the jump markers - without a page reload.
 */
import { useCallback } from "react";

import { useGameTags } from "./GameTagsProvider";
import { HotkeyTagger, type CapturedTagResult } from "./HotkeyTagger";
import { TagList } from "./edit/TagList";
import type { EditableTag } from "./edit/queries";

import { usePlayerController } from "@/features/player";
import type { RosterPlayer } from "@/features/tag-players";

export interface TaggingPanelProps {
  /** The game whose moments are being tagged. */
  readonly gameId: string;
  /** Every selectable player, for the per-tag players/visibility picker (P0-7). */
  readonly roster?: readonly RosterPlayer[];
}

export function TaggingPanel({ gameId, roster = [] }: TaggingPanelProps) {
  const { getGameTimeS, durationS } = usePlayerController();
  const { tags, addTag, replaceTag, removeTag } = useGameTags();

  // A hotkey capture defaults to team visibility (the `tags.visibility` default);
  // the store inserts it in start order so the list stays sorted like the server.
  const handleCaptured = useCallback(
    (captured: CapturedTagResult) =>
      addTag({ ...captured, visibility: "team" }),
    [addTag],
  );

  const handleEdited = useCallback(
    (edited: EditableTag) => replaceTag(edited),
    [replaceTag],
  );

  const handleDeleted = useCallback((id: string) => removeTag(id), [removeTag]);

  return (
    <>
      <HotkeyTagger
        gameId={gameId}
        getCurrentTimeS={getGameTimeS}
        totalDurationS={durationS}
        onCaptured={handleCaptured}
      />
      <TagList
        tags={tags}
        roster={roster}
        onEdited={handleEdited}
        onDeleted={handleDeleted}
      />
    </>
  );
}
