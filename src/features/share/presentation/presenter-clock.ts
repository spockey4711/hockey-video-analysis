/**
 * The clock in the presenter's console on a second screen: the time of day,
 * and how long the presentation has run, as a speaker keeps an eye on both.
 */

/** The time of day, as `14:05`. */
export function formatTimeOfDay(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** How long it ran, as `4:07`, or `1:04:07` past an hour. */
export function formatElapsed(ms: number): string {
  const total = Math.max(Math.floor(ms / 1000), 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  if (hours === 0) return `${minutes}:${seconds}`;
  return `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`;
}
