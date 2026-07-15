/**
 * Request-body validation for `PUT /api/tags/[id]/players` (P0-7). Never trusts
 * the client: the player set and visibility are checked before they reach the
 * database. The tag id itself comes from the route path, not the body.
 *
 * Invariant: a `single` (player-specific) tag must name at least one player,
 * otherwise its clip would surface on no share link at all - a per-player link
 * shows that player's `single` clips plus team-wide ones (P0-11), so a
 * player-less `single` tag is unreachable. A `team` tag may name players (whose
 * involvement is still recorded) or none.
 */

/** Who a tag and its cut clip are shared with (mirrors the `visibility` enum). */
export type Visibility = "team" | "single";

/** A validated player-link update ready to persist for a single tag. */
export interface TagPlayersInput {
  readonly visibility: Visibility;
  /** Distinct player ids the tag involves; may be empty only for `team`. */
  readonly playerIds: readonly string[];
}

export type ParseResult =
  | { readonly ok: true; readonly value: TagPlayersInput }
  | { readonly ok: false; readonly error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(error: string): ParseResult {
  return { ok: false, error };
}

function isVisibility(value: unknown): value is Visibility {
  return value === "team" || value === "single";
}

/**
 * Parse and validate an untrusted `PUT /api/tags/[id]/players` body into a
 * {@link TagPlayersInput}. Duplicate player ids are collapsed so the caller can
 * insert the set without tripping the `tag_players` primary key.
 */
export function parseTagPlayersInput(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return fail("body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;

  if (!isVisibility(body.visibility)) {
    return fail('visibility must be "team" or "single"');
  }
  if (!Array.isArray(body.playerIds)) {
    return fail("playerIds must be an array");
  }

  const playerIds: string[] = [];
  const seen = new Set<string>();
  for (const id of body.playerIds) {
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return fail("each player id must be a valid player id");
    }
    if (!seen.has(id)) {
      seen.add(id);
      playerIds.push(id);
    }
  }

  if (body.visibility === "single" && playerIds.length === 0) {
    return fail("a single (player-specific) tag must name at least one player");
  }

  return { ok: true, value: { visibility: body.visibility, playerIds } };
}
