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

/** Max length of one presenter note: a few talking points, bounded to keep rows sane. */
export const MAX_PRESENTER_NOTE_LENGTH = 1000;

/** Form field carrying the note for the whole collection. */
export const COLLECTION_NOTE_FIELD = "collectionNote";

/** Prefix of the form field carrying one clip's note; the clip id follows it. */
export const CLIP_NOTE_FIELD_PREFIX = "clipNote:";

/** The presenter notes a coach submitted, ready to store. */
export interface PresenterNotesInput {
  /** The collection note, `null` to clear it. */
  readonly collection: string | null;
  /** Clip id to its note, `null` to clear it; only the submitted clips. */
  readonly clips: ReadonlyMap<string, string | null>;
}

/**
 * Normalize one raw presenter note: unify line breaks, trim, and return it, `null`
 * when it is empty (clearing the note), or `undefined` when it is not text or is
 * over {@link MAX_PRESENTER_NOTE_LENGTH}. Line breaks count as one character, as
 * in the textarea's own `maxLength`.
 */
export function normalizePresenterNote(
  value: unknown,
): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\r\n?/g, "\n").trim();
  if (trimmed.length > MAX_PRESENTER_NOTE_LENGTH) return undefined;
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Read the presenter notes from the notes form: the collection note plus one
 * `clipNote:<clip id>` field per clip. Returns `null` when the collection note
 * is missing or any note is invalid, so nothing is half-saved. A field whose
 * clip id is malformed is ignored; the query only ever touches member clips.
 */
export function parsePresenterNotes(
  formData: FormData,
): PresenterNotesInput | null {
  const collection = normalizePresenterNote(
    formData.get(COLLECTION_NOTE_FIELD),
  );
  if (collection === undefined) return null;

  const clips = new Map<string, string | null>();
  for (const [field, value] of formData.entries()) {
    if (!field.startsWith(CLIP_NOTE_FIELD_PREFIX)) continue;
    const clipId = field.slice(CLIP_NOTE_FIELD_PREFIX.length);
    if (!isValidId(clipId)) continue;
    const note = normalizePresenterNote(value);
    if (note === undefined) return null;
    clips.set(clipId.toLowerCase(), note);
  }
  return { collection, clips };
}
