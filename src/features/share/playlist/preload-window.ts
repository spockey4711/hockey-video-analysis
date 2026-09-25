/**
 * Pure rules for loading clips ahead on the share links. Clips are cut at full
 * resolution, so each one is large: the players keep the current clip loading
 * as usual and fetch only the next few in playlist order in the background, so
 * switching on starts without waiting while a phone's data and memory stay
 * bounded. Nothing behind the current clip is kept or fetched.
 */

import { clampIndex } from "./playlist-navigation";

/** How many clips after the current one load ahead. */
export const PRELOAD_AHEAD = 2;

/** How much of a clip ahead the browser should fetch (the `preload` value). */
export type PreloadLevel = "auto" | "metadata";

export interface PreloadWindow {
  /** The indices to load ahead, in playlist order, never the current one. */
  readonly indices: readonly number[];
  readonly preload: PreloadLevel;
}

/**
 * The clips to load ahead of the one at `current` in a list of `length`: up to
 * {@link PRELOAD_AHEAD} after it, stopping at the last clip. With the viewer's
 * data saver on (`saveData`), the same clips load only their metadata.
 */
export function preloadWindow(
  current: number,
  length: number,
  saveData: boolean,
): PreloadWindow {
  const indices: number[] = [];
  if (length > 0) {
    const first = clampIndex(current, length) + 1;
    const end = Math.min(length, first + PRELOAD_AHEAD);
    for (let index = first; index < end; index += 1) indices.push(index);
  }
  return { indices, preload: saveData ? "metadata" : "auto" };
}
