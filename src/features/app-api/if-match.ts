/**
 * The `If-Match` precondition of the Mac app's writes (ADR 0013, Mac plan S3).
 *
 * An update or delete from the Mac names the row version it started from, as
 * an entity tag: `If-Match: "7"`. The route refuses the write with `409` and
 * the current row when the row has moved since, so nothing is overwritten
 * silently. The web sends no header and keeps writing without the check.
 */

/** The request header carrying the base version. */
export const IF_MATCH_HEADER = "If-Match";

/** What an `If-Match` header asked for. */
export type IfMatch =
  | { readonly ok: true; readonly version: number | null }
  | { readonly ok: false; readonly error: string };

// A strong entity tag holding a version; the bare number is accepted too.
// Versions start at 1 and stay far below 2^31.
const ENTITY_TAG = /^(?:"([1-9]\d{0,9})"|([1-9]\d{0,9}))$/;

/**
 * Parse an `If-Match` header value: `version: null` when there is no header
 * (write without the check), the version it names, or an error for anything
 * else - a list, a weak tag or `*` is not a version and is refused rather than
 * silently ignored.
 */
export function parseIfMatch(raw: string | null): IfMatch {
  if (raw === null) return { ok: true, version: null };
  const match = ENTITY_TAG.exec(raw.trim());
  const digits = match?.[1] ?? match?.[2];
  const version = digits === undefined ? NaN : Number(digits);
  if (!Number.isSafeInteger(version) || version > 2_147_483_647) {
    return { ok: false, error: "If-Match must name one row version" };
  }
  return { ok: true, version };
}

/** The `ETag` header value for a row version. */
export function entityTag(version: number): string {
  return `"${version}"`;
}
