/**
 * The optional end date of a collection's share link. The coach picks a day;
 * the link works through the end of that day in the team's time zone and
 * shows "Link nicht mehr gültig" from midnight on. Stored as that midnight
 * (`collections.share_expires_at`), so the check is one comparison with the
 * clock. Pure and IO-free so the rules are testable and the client can use
 * them too.
 */

/** The team's time zone; an end date means the end of that day here. */
export const SHARE_EXPIRY_TIME_ZONE = "Europe/Berlin";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether a link with this end instant has stopped working at `now`. */
export function isShareExpired(
  expiresAt: Date | null,
  now: Date = new Date(),
): boolean {
  return expiresAt !== null && now.getTime() >= expiresAt.getTime();
}

/** The calendar day (`YYYY-MM-DD`) an instant falls on in the time zone. */
export function zonedDate(
  instant: Date,
  timeZone: string = SHARE_EXPIRY_TIME_ZONE,
): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** How far the zone's wall clock is ahead of UTC at an instant, in ms. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const wallClock = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return wallClock - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant a link with this end date stops working: midnight after the
 * day, in the time zone. Midnight never falls in a DST gap in Europe, so one
 * correction pass for the offset at the result is enough.
 */
export function shareExpiryInstant(
  endDate: string,
  timeZone: string = SHARE_EXPIRY_TIME_ZONE,
): Date {
  const match = DATE_PATTERN.exec(endDate);
  if (!match) throw new RangeError("end date must be YYYY-MM-DD");
  const [, year, month, day] = match.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const midnightUtc = Date.UTC(year, month - 1, day + 1);
  const guess = midnightUtc - zoneOffsetMs(new Date(midnightUtc), timeZone);
  return new Date(midnightUtc - zoneOffsetMs(new Date(guess), timeZone));
}

/** The last day a link with this end instant works (the date the coach picked). */
export function shareEndDate(
  expiresAt: Date,
  timeZone: string = SHARE_EXPIRY_TIME_ZONE,
): string {
  return zonedDate(new Date(expiresAt.getTime() - 1), timeZone);
}

/** Why an end date was refused. */
export type ShareExpiryProblem = "invalid" | "past";

export type ShareExpiryParse =
  | { readonly ok: true; readonly value: Date | null }
  | { readonly ok: false; readonly problem: ShareExpiryProblem };

/**
 * Parse the end date from the form: empty removes it (the link works until it
 * is reset), a real calendar day from today on sets it. A day before today
 * would end the link at once, so it is refused rather than silently applied.
 */
export function parseShareEndDate(
  input: unknown,
  now: Date = new Date(),
  timeZone: string = SHARE_EXPIRY_TIME_ZONE,
): ShareExpiryParse {
  if (typeof input !== "string") return { ok: false, problem: "invalid" };
  const value = input.trim();
  if (value === "") return { ok: true, value: null };

  const match = DATE_PATTERN.exec(value);
  if (!match) return { ok: false, problem: "invalid" };
  const [, year, month, day] = match.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  ) {
    return { ok: false, problem: "invalid" };
  }
  // Same-format strings compare as dates.
  if (value < zonedDate(now, timeZone)) return { ok: false, problem: "past" };
  return { ok: true, value: shareExpiryInstant(value, timeZone) };
}

/** A day as the coach reads it: `12.10.2026`. */
export function formatShareEndDate(endDate: string): string {
  const match = DATE_PATTERN.exec(endDate);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : endDate;
}
