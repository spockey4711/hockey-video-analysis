/**
 * Request validation for the clips API (P0-9). Never trusts the client: the
 * enqueue body and the status-query params are checked before they reach the
 * database. Only a tag id crosses the wire - `status` and `outputPath` are owned
 * by the server and the worker, never set by a caller.
 */

/** A validated enqueue request: cut a clip for this confirmed tag. */
export interface ClipEnqueueInput {
  readonly tagId: string;
}

export type ParseResult =
  | { readonly ok: true; readonly value: ClipEnqueueInput }
  | { readonly ok: false; readonly error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether an untrusted value is a syntactically valid UUID. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Parse and validate an untrusted `POST /api/clips` body. */
export function parseClipEnqueueInput(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;

  if (!isUuid(body.tagId)) {
    return { ok: false, error: "tagId must be a valid tag id" };
  }

  return { ok: true, value: { tagId: body.tagId } };
}
