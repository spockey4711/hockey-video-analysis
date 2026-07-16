/**
 * Playback-speed scan steps for the watch transport (P2-7). The coach cycles
 * through these to scan a game at normal, double, or quadruple speed while
 * hunting for a moment. Slow-motion (rates below 1x) is a separate lane (P2-11);
 * this covers only forward scan, since HTML5 video cannot play a negative rate.
 */
export const PLAYBACK_RATES = [1, 2, 4] as const;

export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

/** Normal-speed playback; the rate the player resets to on load. */
export const DEFAULT_PLAYBACK_RATE: PlaybackRate = 1;

/**
 * The next rate when cycling the scan control: 1 -> 2 -> 4 -> 1. An unknown
 * current rate (e.g. a future slow-mo value) falls back to normal speed so the
 * cycle always lands on a known step.
 */
export function nextPlaybackRate(current: number): PlaybackRate {
  const index = PLAYBACK_RATES.indexOf(current as PlaybackRate);
  if (index === -1) return DEFAULT_PLAYBACK_RATE;
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
}

/**
 * Step the rate one scan step up (`+1`) or down (`-1`), clamped to the ends of
 * {@link PLAYBACK_RATES} - unlike {@link nextPlaybackRate}, this does not wrap,
 * so the keyboard up/down keys never jump from top speed back to normal. An
 * unknown current rate falls back to normal speed.
 */
export function adjustPlaybackRate(
  current: number,
  direction: 1 | -1,
): PlaybackRate {
  const index = PLAYBACK_RATES.indexOf(current as PlaybackRate);
  if (index === -1) return DEFAULT_PLAYBACK_RATE;
  const next = Math.min(
    Math.max(index + direction, 0),
    PLAYBACK_RATES.length - 1,
  );
  return PLAYBACK_RATES[next];
}

/** Format a rate for the scan control label, e.g. `2x`. */
export function formatPlaybackRate(rate: number): string {
  return `${rate}x`;
}
