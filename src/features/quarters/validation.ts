/**
 * Request-body validation for `PUT /api/quarters` (P1-4). Never trusts the
 * client: the whole quarter set is checked before it reaches the database. The
 * set must be a contiguous run of quarters starting at 1 (so Q3 cannot exist
 * without Q1/Q2) whose spans are strictly ordered and non-overlapping, which is
 * what {@link quarterAt} and per-quarter clip math rely on.
 */
import type { Quarter } from "./navigation";

/** The most quarters a field-hockey game has (PRD 5.3). */
export const MAX_QUARTERS = 4;

/** A validated quarter set ready to persist for a single game. */
export interface QuartersInput {
  readonly gameId: string;
  readonly quarters: readonly Quarter[];
}

export type ParseResult =
  | { readonly ok: true; readonly value: QuartersInput }
  | { readonly ok: false; readonly error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(error: string): ParseResult {
  return { ok: false, error };
}

/** Parse one raw entry into a `Quarter`, or return an error message. */
function parseQuarter(raw: unknown): { quarter: Quarter } | { error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { error: "each quarter must be an object" };
  }
  const entry = raw as Record<string, unknown>;

  if (
    typeof entry.index !== "number" ||
    !Number.isInteger(entry.index) ||
    entry.index < 1 ||
    entry.index > MAX_QUARTERS
  ) {
    return { error: `index must be an integer in 1..${MAX_QUARTERS}` };
  }
  if (
    typeof entry.startS !== "number" ||
    !Number.isFinite(entry.startS) ||
    entry.startS < 0
  ) {
    return { error: "startS must be a non-negative number" };
  }

  let endS: number | null = null;
  if (entry.endS !== undefined && entry.endS !== null) {
    if (typeof entry.endS !== "number" || !Number.isFinite(entry.endS)) {
      return { error: "endS must be a number" };
    }
    if (entry.endS <= entry.startS) {
      return { error: "endS must be greater than startS" };
    }
    endS = entry.endS;
  }

  return { quarter: { index: entry.index, startS: entry.startS, endS } };
}

/**
 * Parse and validate an untrusted `PUT /api/quarters` body into a
 * `QuartersInput`. Beyond per-quarter checks it enforces the cross-quarter
 * invariants: indices are a contiguous `1..N` run, and in index order each
 * quarter starts strictly after the previous one and never overlaps the
 * previous quarter's explicit end.
 */
export function parseQuartersInput(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return fail("body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.gameId !== "string" || !UUID_RE.test(body.gameId)) {
    return fail("gameId must be a valid game id");
  }
  if (!Array.isArray(body.quarters)) {
    return fail("quarters must be an array");
  }
  if (body.quarters.length === 0) {
    return fail("quarters must not be empty");
  }
  if (body.quarters.length > MAX_QUARTERS) {
    return fail(`quarters must have at most ${MAX_QUARTERS} entries`);
  }

  const quarters: Quarter[] = [];
  for (const raw_ of body.quarters) {
    const parsed = parseQuarter(raw_);
    if ("error" in parsed) return fail(parsed.error);
    quarters.push(parsed.quarter);
  }

  quarters.sort((a, b) => a.index - b.index);

  for (let i = 0; i < quarters.length; i += 1) {
    if (quarters[i].index !== i + 1) {
      return fail("quarter indices must be a contiguous run starting at 1");
    }
    if (i > 0) {
      const prev = quarters[i - 1];
      const current = quarters[i];
      if (current.startS <= prev.startS) {
        return fail("each quarter must start after the previous quarter");
      }
      if (prev.endS !== null && prev.endS > current.startS) {
        return fail("quarters must not overlap");
      }
    }
  }

  return { ok: true, value: { gameId: body.gameId, quarters } };
}
