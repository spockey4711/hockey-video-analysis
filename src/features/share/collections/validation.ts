/**
 * Input validation for the clip-collections curation actions (P2-13). Every
 * untrusted value arrives from a coach form: the collection name, the collection
 * id, and the set of clip ids to include. Each is checked before any query runs;
 * an invalid value is rejected without touching the database. Ids are also
 * re-checked against the ready-clip set server-side (see the membership query),
 * so this layer only guards shape.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Max collection name length; wide enough for a descriptive title, bounded to keep rows sane. */
export const MAX_NAME_LENGTH = 120;

/** True when `value` is a syntactically valid id (a v-any UUID). */
export function isValidId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Normalize a raw collection name: trim surrounding whitespace and return it, or
 * `null` when it is empty or over {@link MAX_NAME_LENGTH}. The trimmed value is
 * what gets stored, so callers persist the return rather than the raw input.
 */
export function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return null;
  return trimmed;
}

/**
 * Keep only the syntactically valid, unique ids from a raw clip-id list. Invalid
 * entries are dropped rather than failing the whole save, and the server still
 * intersects the result with the ready-clip set, so a forged-but-well-formed id
 * that is not a ready clip simply never becomes a member.
 */
export function normalizeClipIds(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    if (isValidId(value)) seen.add(value);
  }
  return [...seen];
}
