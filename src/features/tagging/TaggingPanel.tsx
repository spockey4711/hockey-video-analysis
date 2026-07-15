"use client";

/**
 * Connects the watch player to the hotkey-tagging leaf (P0-6) and the editable
 * tag list (P0-8). The watch page mounts this into the player's `sidebar` slot,
 * where it runs inside the player's context and reads the live controller. It
 * forwards frame-current game time (`getGameTimeS`) and the total game length to
 * {@link HotkeyTagger}, keeping that leaf decoupled from how the player tracks
 * time, and owns the tag-list state so a fresh hotkey capture and an inline edit
 * or delete in {@link TagList} stay in sync without a page reload.
 */
import { useCallback, useState } from "react";

import { HotkeyTagger, type CapturedTagResult } from "./HotkeyTagger";
import { TagList } from "./edit/TagList";
import type { EditableTag } from "./edit/queries";

import { usePlayerController } from "@/features/player";

export interface TaggingPanelProps {
  /** The game whose moments are being tagged. */
  readonly gameId: string;
  /** Tags already captured for this game, seeding the editable list (P0-8). */
  readonly initialTags?: readonly EditableTag[];
}

/** Order tags by their clip-window start, matching the server list order. */
function byStart(a: EditableTag, b: EditableTag): number {
  return a.startS - b.startS;
}

export function TaggingPanel({ gameId, initialTags = [] }: TaggingPanelProps) {
  const { getGameTimeS, durationS } = usePlayerController();
  const [tags, setTags] = useState<EditableTag[]>(() =>
    [...initialTags].sort(byStart),
  );

  // A hotkey capture defaults to team visibility (the `tags.visibility` default);
  // insert it in start order so the list stays sorted like the server's.
  const handleCaptured = useCallback((captured: CapturedTagResult) => {
    setTags((current) =>
      [...current, { ...captured, visibility: "team" as const }].sort(byStart),
    );
  }, []);

  const handleEdited = useCallback((edited: EditableTag) => {
    setTags((current) =>
      current.map((tag) => (tag.id === edited.id ? edited : tag)).sort(byStart),
    );
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setTags((current) => current.filter((tag) => tag.id !== id));
  }, []);

  return (
    <>
      <HotkeyTagger
        gameId={gameId}
        getCurrentTimeS={getGameTimeS}
        totalDurationS={durationS}
        onCaptured={handleCaptured}
      />
      <TagList tags={tags} onEdited={handleEdited} onDeleted={handleDeleted} />
    </>
  );
}
