/**
 * Format a comment's `createdAt` for the German-speaking audience, e.g.
 * "22.09.2026, 14:05". Rendered in the viewer's local time zone; an ISO string
 * the browser cannot parse falls back to an empty string rather than "Invalid
 * Date" (the API always sends valid timestamps, this only guards the UI).
 */
export function formatCommentDate(
  createdAt: string,
  timeZone?: string,
): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}
