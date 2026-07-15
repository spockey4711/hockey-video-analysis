/**
 * Input validation for whistle-suggestion review (P1-5). Never trusts the
 * client: the candidate id (from the request path) and the review decision
 * (from the request body) are checked before any query runs. An unknown
 * decision can never reach the database, so a candidate is only ever confirmed
 * or rejected - never left in an invented state.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `value` is a syntactically valid whistle-candidate id (a UUID). */
export function isValidCandidateId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** A coach's verdict on a candidate: commit it to a goal tag, or discard it. */
export type ReviewDecision = "confirm" | "reject";

/** A validated review body ready to apply to a candidate. */
export interface ReviewInput {
  readonly decision: ReviewDecision;
}

export type ParseResult =
  | { readonly ok: true; readonly value: ReviewInput }
  | { readonly ok: false; readonly error: string };

const DECISIONS: readonly ReviewDecision[] = ["confirm", "reject"];

/** Parse and validate an untrusted `PATCH /api/suggestions/[id]` body. */
export function parseReviewInput(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;

  if (
    typeof body.decision !== "string" ||
    !DECISIONS.includes(body.decision as ReviewDecision)
  ) {
    return { ok: false, error: "decision must be 'confirm' or 'reject'" };
  }

  return { ok: true, value: { decision: body.decision as ReviewDecision } };
}
