/**
 * Request-body validation for `POST /api/tags` (P0-6). Never trusts the client:
 * every field is checked before it reaches the database, and `type` must be a
 * configured tag-type key so an unknown key can never be persisted.
 */
import { isTagTypeKey } from "@/lib/tag-types";

/** A validated tag ready to persist (author and source are stamped server-side). */
export interface TagInput {
  readonly gameId: string;
  readonly type: string;
  readonly startS: number;
  /** Explicit end is optional; the default window otherwise applies (PRD 5.2). */
  readonly endS: number | null;
}

export type ParseResult =
  | { readonly ok: true; readonly value: TagInput }
  | { readonly ok: false; readonly error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(error: string): ParseResult {
  return { ok: false, error };
}

/** Parse and validate an untrusted `POST /api/tags` body into a `TagInput`. */
export function parseTagInput(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return fail("body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.gameId !== "string" || !UUID_RE.test(body.gameId)) {
    return fail("gameId must be a valid game id");
  }
  if (typeof body.type !== "string" || !isTagTypeKey(body.type)) {
    return fail("type must be a known tag type");
  }
  if (
    typeof body.startS !== "number" ||
    !Number.isFinite(body.startS) ||
    body.startS < 0
  ) {
    return fail("startS must be a non-negative number");
  }

  let endS: number | null = null;
  if (body.endS !== undefined && body.endS !== null) {
    if (typeof body.endS !== "number" || !Number.isFinite(body.endS)) {
      return fail("endS must be a number");
    }
    if (body.endS <= body.startS) {
      return fail("endS must be greater than startS");
    }
    endS = body.endS;
  }

  return {
    ok: true,
    value: { gameId: body.gameId, type: body.type, startS: body.startS, endS },
  };
}
