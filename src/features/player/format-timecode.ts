/**
 * Formats a global game-time offset (seconds) as a clock string for the player
 * transport. Kept as a small pure helper local to the player: the design
 * system's `Timecode` component (DS-3) lands in the same wave and can adopt this
 * once available, but the player must not block on it.
 */

/**
 * Format a game-time offset in seconds as `M:SS`, or `H:MM:SS` once the game
 * reaches an hour. Fractional seconds are floored; non-finite or negative input
 * clamps to `0:00` so a transient bad value never renders as `NaN`.
 */
export function formatGameClock(totalSeconds: number): string {
  const safe =
    Number.isFinite(totalSeconds) && totalSeconds > 0
      ? Math.floor(totalSeconds)
      : 0;

  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0) {
    const paddedMinutes = String(minutes).padStart(2, "0");
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}
