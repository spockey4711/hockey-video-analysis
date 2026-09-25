/**
 * Input validation for the clip-collections curation actions (P2-13). Every
 * untrusted value arrives from a coach form or a clip editor request body: the
 * collection name, the collection id, and the clip ids to include. Each is checked before any query runs;
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

/**
 * Max length of one team note: the intro or a clip's text, read off a title
 * card on a projector or under a clip on a phone, so kept short.
 */
export const MAX_TEAM_NOTE_LENGTH = 500;

/** Form field carrying the team intro for the whole collection. */
export const TEAM_INTRO_FIELD = "teamIntro";

/** Prefix of the form field carrying one clip's team note; the clip id follows it. */
export const TEAM_CLIP_NOTE_FIELD_PREFIX = "teamNote:";

/**
 * The notes a coach submitted for a collection, ready to store: the private
 * presenter notes or the notes for the team, which share this shape but never
 * a form, a field or a column.
 */
export interface CollectionNotesInput {
  /** The collection note, `null` to clear it. */
  readonly collection: string | null;
  /** Clip id to its note, `null` to clear it; only the submitted clips. */
  readonly clips: ReadonlyMap<string, string | null>;
}

/** Where one notes form carries its notes, and how long each may be. */
interface NotesForm {
  readonly collectionField: string;
  readonly clipFieldPrefix: string;
  readonly maxLength: number;
}

const PRESENTER_NOTES_FORM: NotesForm = {
  collectionField: COLLECTION_NOTE_FIELD,
  clipFieldPrefix: CLIP_NOTE_FIELD_PREFIX,
  maxLength: MAX_PRESENTER_NOTE_LENGTH,
};

const TEAM_NOTES_FORM: NotesForm = {
  collectionField: TEAM_INTRO_FIELD,
  clipFieldPrefix: TEAM_CLIP_NOTE_FIELD_PREFIX,
  maxLength: MAX_TEAM_NOTE_LENGTH,
};

/**
 * Normalize one raw note: unify line breaks, trim, and return it, `null` when
 * it is empty (clearing the note), or `undefined` when it is not text or is
 * over `maxLength`. Line breaks count as one character, as in the textarea's
 * own `maxLength`.
 */
function normalizeNote(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\r\n?/g, "\n").trim();
  if (trimmed.length > maxLength) return undefined;
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Normalize one raw presenter note (see {@link normalizeNote}), capped at
 * {@link MAX_PRESENTER_NOTE_LENGTH}.
 */
export function normalizePresenterNote(
  value: unknown,
): string | null | undefined {
  return normalizeNote(value, MAX_PRESENTER_NOTE_LENGTH);
}

/**
 * Normalize one raw team note (see {@link normalizeNote}), capped at
 * {@link MAX_TEAM_NOTE_LENGTH}.
 */
export function normalizeTeamNote(value: unknown): string | null | undefined {
  return normalizeNote(value, MAX_TEAM_NOTE_LENGTH);
}

/**
 * Read one notes form: the collection note plus one `<prefix><clip id>` field
 * per clip. Returns `null` when the collection note is missing or any note is
 * invalid, so nothing is half-saved. A field whose clip id is malformed is
 * ignored; the query only ever touches member clips.
 */
function parseNotes(
  formData: FormData,
  form: NotesForm,
): CollectionNotesInput | null {
  const collection = normalizeNote(
    formData.get(form.collectionField),
    form.maxLength,
  );
  if (collection === undefined) return null;

  const clips = new Map<string, string | null>();
  for (const [field, value] of formData.entries()) {
    if (!field.startsWith(form.clipFieldPrefix)) continue;
    const clipId = field.slice(form.clipFieldPrefix.length);
    if (!isValidId(clipId)) continue;
    const note = normalizeNote(value, form.maxLength);
    if (note === undefined) return null;
    clips.set(clipId.toLowerCase(), note);
  }
  return { collection, clips };
}

/**
 * Read the presenter notes from the presenter notes form: the collection note
 * plus one `clipNote:<clip id>` field per clip (see {@link parseNotes}).
 */
export function parsePresenterNotes(
  formData: FormData,
): CollectionNotesInput | null {
  return parseNotes(formData, PRESENTER_NOTES_FORM);
}

/**
 * Read the team notes from the team notes form: the intro plus one
 * `teamNote:<clip id>` field per clip (see {@link parseNotes}). Presenter note
 * fields in the same submission are never read, so a private note can not end
 * up in a public column.
 */
export function parseTeamNotes(
  formData: FormData,
): CollectionNotesInput | null {
  return parseNotes(formData, TEAM_NOTES_FORM);
}

/** The result of reading an untrusted JSON request body. */
export type BodyParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

/**
 * Read a `POST /api/collections/[id]/clips` body: `{ clipId }`, the one clip
 * the clip editor's picker adds. The query still checks the clip is ready.
 */
export function parseAddClipInput(
  raw: unknown,
): BodyParseResult<{ clipId: string }> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const { clipId } = raw as Record<string, unknown>;
  if (!isValidId(clipId)) {
    return { ok: false, error: "clipId must be a valid clip id" };
  }
  return { ok: true, value: { clipId } };
}

/**
 * Read a `POST /api/collections` body: `{ name, clipId? }`. The name is
 * normalized as on the create form; `clipId`, when given, is the clip the new
 * collection starts with.
 */
export function parseCreateCollectionInput(
  raw: unknown,
): BodyParseResult<{ name: string; clipId: string | null }> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;
  const name = normalizeName(body.name);
  if (name === null) {
    return {
      ok: false,
      error: `name must be 1-${MAX_NAME_LENGTH} characters`,
    };
  }
  let clipId: string | null = null;
  if (body.clipId !== undefined) {
    if (!isValidId(body.clipId)) {
      return { ok: false, error: "clipId must be a valid clip id" };
    }
    clipId = body.clipId;
  }
  return { ok: true, value: { name, clipId } };
}
