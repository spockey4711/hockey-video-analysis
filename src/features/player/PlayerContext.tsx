"use client";

import { createContext, useContext } from "react";

/**
 * The live controls and state of the watch player, published to slot children so
 * sibling feature lanes (hotkey tagging in P0-6, the quarter overlay in P1-4)
 * read the current game time and drive seeks without owning the player. This is
 * the stable contract those lanes program against; keep it small.
 */
export interface PlayerController {
  /** Current position on the global game timeline, in seconds. */
  readonly gameTimeS: number;
  /** Total game length (sum of every chapter), in seconds. */
  readonly durationS: number;
  readonly isPlaying: boolean;
  readonly isBuffering: boolean;
  /** Current scan speed multiplier applied to playback (1 = normal). */
  readonly playbackRate: number;
  /** Zero-based index of the chapter currently loaded in the `<video>`. */
  readonly activeSourceIndex: number;
  /**
   * Read the exact current game time straight from the video element. Prefer
   * this over `gameTimeS` when capturing a moment (tagging): it is frame-current
   * rather than throttled to the last render.
   */
  readonly getGameTimeS: () => number;
  /** Seek to an absolute game time (clamped to `[0, durationS]`). */
  readonly seekTo: (gameTimeS: number) => void;
  /** Seek relative to the current position (negative rewinds). */
  readonly seekBy: (deltaS: number) => void;
  /**
   * Pause, then seek relative to the current position. The building block for
   * frame/second stepping: a step always lands on a still frame so the coach can
   * study it, never resuming play. Negative steps backward.
   */
  readonly stepBy: (deltaS: number) => void;
  readonly play: () => void;
  readonly pause: () => void;
  readonly togglePlay: () => void;
  /**
   * Set the scan speed multiplier. Persists across chapter swaps; a fresh `src`
   * would otherwise reset the element to 1x.
   */
  readonly setPlaybackRate: (rate: number) => void;
}

const PlayerContext = createContext<PlayerController | null>(null);

export const PlayerControllerProvider = PlayerContext.Provider;

/**
 * Read the watch player's controller from a slot child. Throws if used outside
 * the player, so a slot rendered in the wrong place fails loudly in development
 * rather than silently doing nothing.
 */
export function usePlayerController(): PlayerController {
  const controller = useContext(PlayerContext);
  if (!controller) {
    throw new Error(
      "usePlayerController must be used inside the watch player (ContinuousPlayer).",
    );
  }
  return controller;
}
