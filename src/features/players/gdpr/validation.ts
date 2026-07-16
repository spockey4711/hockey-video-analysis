/**
 * Input validation for player erasure (P1-6). The only untrusted input is the
 * player id the coach asks to delete; it arrives from a form field, so it is
 * checked against the UUID shape before it reaches a query. An invalid id is
 * rejected without touching the database.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `value` is a syntactically valid player id (a v-any UUID). */
export function isValidPlayerId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
