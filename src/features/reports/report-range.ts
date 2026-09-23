/**
 * The optional date range of the team overview (P2-12), read from the page's
 * and the CSV route's `?from=YYYY-MM-DD&to=YYYY-MM-DD` query. Pure, so the page,
 * the export and the tests share one reading of the URL.
 *
 * The range filters on a game's played-on date and both ends are inclusive. A
 * missing, malformed or impossible date (`2026-02-30`) leaves that end open
 * rather than erroring - the query string is user-editable, and an open end is
 * the obvious fallback. A reversed range is swapped instead of matching nothing.
 */

/** A range of played-on dates; `null` leaves that end open. */
export interface ReportRange {
  readonly from: string | null;
  readonly to: string | null;
}

/** A query parameter as Next.js hands it to a page. */
type QueryValue = string | readonly string[] | undefined;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The value when it is a real calendar date in `YYYY-MM-DD`, else `null`. */
function isoDate(value: QueryValue): string | null {
  if (typeof value !== "string") return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  // A UTC round trip rejects overflowing parts (month 13, 30 February).
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : null;
}

/** Read the range from the `from` and `to` query parameters. */
export function parseReportRange(query: {
  readonly from?: QueryValue;
  readonly to?: QueryValue;
}): ReportRange {
  const from = isoDate(query.from);
  const to = isoDate(query.to);
  // ISO dates compare correctly as strings.
  if (from && to && from > to) return { from: to, to: from };
  return { from, to };
}

/** Whether the range narrows the games at all. */
export function isRangeSet(range: ReportRange): boolean {
  return range.from !== null || range.to !== null;
}

/** The range as a query string (with `?`), or `""` for the open range. */
export function reportRangeQuery(range: ReportRange): string {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const query = params.toString();
  return query ? `?${query}` : "";
}
