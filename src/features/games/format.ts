/**
 * Pure display helpers for the games list. Kept framework-free so they are
 * unit-testable and reused by any surface that renders a game summary. (DS-3's
 * `Timecode` component will format single tag timestamps; this formats a whole
 * game's rolled-up length, which is a coarser, list-level concern.)
 */

/**
 * Format a total duration in seconds as `H:MM:SS` (or `MM:SS` under an hour).
 * Fractional seconds are floored to whole seconds for a compact list label.
 */
export function formatDuration(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/**
 * Format an ISO `YYYY-MM-DD` played-on date as German `DD.MM.YYYY`. Returns
 * `null` for a missing or malformed value so callers can omit the field. Works
 * purely on the string parts to avoid any timezone shift from `Date` parsing.
 */
export function formatPlayedOn(playedOn: string | null): string | null {
  if (!playedOn) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(playedOn);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}
