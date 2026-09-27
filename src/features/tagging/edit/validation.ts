/**
 * Request-body validation for `PATCH /api/tags/[id]` (P0-8). Never trusts the
 * client: a tag edit replaces its editable fields as a unit - the tag `type`
 * and its `[startS, endS]` clip window - so every field is checked before it
 * reaches the database, and `type` and every further type must be a configured
 * tag-type key so an unknown key can never be persisted. The further types
 * (`extraTypes`, ADR 0016) are optional: a client that does not send them (a
 * Mac build from before them) keeps the stored ones. The tag id itself comes
 * from the route path, not the body, and visibility/players keep their own
 * route (P0-7).
 */
import { isTagTypeKey, parseExtraTypes } from "@/lib/tag-types";

/** A validated tag edit ready to persist (the full editable field set). */
export interface TagEditInput {
  readonly type: string;
  /** The further types to store; absent keeps the stored ones (ADR 0016). */
  readonly extraTypes?: readonly string[];
  readonly startS: number;
  /** Explicit end, or null to fall back to the type's default window (PRD 5.2). */
  readonly endS: number | null;
}

export type ParseResult =
  | { readonly ok: true; readonly value: TagEditInput }
  | { readonly ok: false; readonly error: string };

function fail(error: string): ParseResult {
  return { ok: false, error };
}

/** Parse and validate an untrusted `PATCH /api/tags/[id]` body into a `TagEditInput`. */
export function parseTagEditInput(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return fail("body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.type !== "string" || !isTagTypeKey(body.type)) {
    return fail("type must be a known tag type");
  }
  const extraTypes =
    body.extraTypes === undefined
      ? undefined
      : parseExtraTypes(body.extraTypes, body.type);
  if (extraTypes === null) {
    return fail("extraTypes must be a list of known tag types");
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
    value: {
      type: body.type,
      ...(extraTypes === undefined ? {} : { extraTypes }),
      startS: body.startS,
      endS,
    },
  };
}
