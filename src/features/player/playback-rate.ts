/**
 * Playback-speed ladder for the watch transport: slow-motion for close analysis
 * (P2-11) and fast scan for hunting a moment (P2-7) on one ordered list, so the
 * speed control and the up/down keys walk a single ladder instead of two modes.
 * Every step is a rate HTML5 video plays with sound and without dropping frames;
 * reverse playback is not one of them (no negative rate exists), so backwards
 * analysis goes through the frame/second step keys instead.
 */
export const PLAYBACK_RATES = [0.25, 0.5, 1, 2, 4] as const;

export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

/** Normal-speed playback; the rate the player resets to on load. */
export const DEFAULT_PLAYBACK_RATE: PlaybackRate = 1;

/**
 * The next rate when cycling the speed control, wrapping at the top:
 * 0.25 -> 0.5 -> 1 -> 2 -> 4 -> 0.25. Ascending order keeps the common step
 * (normal -> 2x scan) one click away. An unknown current rate falls back to
 * normal speed so the cycle always lands on a known step.
 */
export function nextPlaybackRate(current: number): PlaybackRate {
  const index = PLAYBACK_RATES.indexOf(current as PlaybackRate);
  if (index === -1) return DEFAULT_PLAYBACK_RATE;
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
}

/**
 * Step the rate one rung up (`+1`) or down (`-1`), clamped to the ends of
 * {@link PLAYBACK_RATES} - unlike {@link nextPlaybackRate}, this does not wrap,
 * so the keyboard up/down keys never jump from top speed to slow motion. An
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

/**
 * Format a rate for the speed control, e.g. `2x` or `0,5x` - German decimal
 * comma, matching the rest of the coach-facing copy.
 */
export function formatPlaybackRate(rate: number): string {
  return `${String(rate).replace(".", ",")}x`;
}
