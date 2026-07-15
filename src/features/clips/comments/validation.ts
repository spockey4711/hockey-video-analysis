/**
 * Request-body validation for `POST /api/clips/[id]/comments` (P1-2). Never
 * trusts the client: a comment carries only a free-text `author` name and a
 * `body`, both of which are checked and trimmed before they reach the database.
 * The clip id comes from the route path, not the body; `createdAt` is set by the
 * server. `author` is free text because comments are written on the login-free
 * share links, where the writer has no coach account to reference.
 */

/** A validated comment ready to persist against a clip. */
export interface CommentInput {
  /** Display name the writer typed; free text, never a coach reference. */
  readonly author: string;
  /** The comment text. */
  readonly body: string;
}

export type ParseResult =
  | { readonly ok: true; readonly value: CommentInput }
  | { readonly ok: false; readonly error: string };

/** Trimmed length limits; keep names short and bodies to a sane paragraph. */
export const AUTHOR_MAX_LENGTH = 80;
export const BODY_MAX_LENGTH = 2000;

function fail(error: string): ParseResult {
  return { ok: false, error };
}

/**
 * Parse and validate an untrusted `POST /api/clips/[id]/comments` body into a
 * {@link CommentInput}. Both fields are trimmed; leading/trailing whitespace is
 * never persisted and a value that is empty once trimmed is rejected.
 */
export function parseCommentInput(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return fail("body must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.author !== "string") {
    return fail("author must be a string");
  }
  if (typeof obj.body !== "string") {
    return fail("body must be a string");
  }

  const author = obj.author.trim();
  if (author.length === 0) {
    return fail("author must not be empty");
  }
  if (author.length > AUTHOR_MAX_LENGTH) {
    return fail(`author must be at most ${AUTHOR_MAX_LENGTH} characters`);
  }

  const body = obj.body.trim();
  if (body.length === 0) {
    return fail("body must not be empty");
  }
  if (body.length > BODY_MAX_LENGTH) {
    return fail(`body must be at most ${BODY_MAX_LENGTH} characters`);
  }

  return { ok: true, value: { author, body } };
}
