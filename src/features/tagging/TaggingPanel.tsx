"use client";

/**
 * Connects the watch player to the hotkey-tagging leaf (P0-6). The watch page
 * mounts this into the player's `sidebar` slot, where it runs inside the
 * player's context and reads the live controller. It forwards frame-current
 * game time (`getGameTimeS`) and the total game length to {@link HotkeyTagger},
 * keeping that leaf decoupled from how the player tracks time.
 */
import { HotkeyTagger } from "./HotkeyTagger";

import { usePlayerController } from "@/features/player";

export interface TaggingPanelProps {
  /** The game whose moments are being tagged. */
  readonly gameId: string;
}

export function TaggingPanel({ gameId }: TaggingPanelProps) {
  const { getGameTimeS, durationS } = usePlayerController();

  return (
    <HotkeyTagger
      gameId={gameId}
      getCurrentTimeS={getGameTimeS}
      totalDurationS={durationS}
    />
  );
}
