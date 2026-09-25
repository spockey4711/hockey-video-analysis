/**
 * The wire contract for anonymous view counting on the collection share link
 * (ADR 0009). The browser reports what a viewer did with a clip; the server
 * trusts none of it and re-checks every field, then derives the day and the
 * viewer key itself. Nothing identifying crosses the wire: a report is the
 * collection's share token (which the viewer already holds in the URL), the
 * clip id and the event type.
 *
 * Kept free of server imports so the browser tracker shares the same types.
 */

/** The endpoint the share link reports to. */
export const VIEW_EVENTS_PATH = "/api/collection-views";

/**
 * What a viewer did with a clip: `click` (started it), `full_view` (played at
 * least {@link FULL_VIEW_SHARE} of it) or `replay` (started it again after
 * finishing it). Mirrors the `view_event_type` database enum.
 */
export const VIEW_EVENT_TYPES = ["click", "full_view", "replay"] as const;

export type ViewEventType = (typeof VIEW_EVENT_TYPES)[number];

/**
 * The share of a clip's length that must actually be played in one run for it
 * to count as a full view. 90 % rather than 100 % so a viewer who stops just
 * before the last frame, or a final `timeupdate` that lands a fraction of a
 * second early, still counts; skipping ahead does not add played time.
 */
export const FULL_VIEW_SHARE = 0.9;

/** Upper bound on a share token; real ones are far shorter. */
export const TOKEN_MAX_LENGTH = 256;

/** A validated report of one event on one clip of a collection link. */
export interface ViewEventInput {
  readonly token: string;
  readonly clipId: string;
  readonly type: ViewEventType;
}

/**
 * The outcome of parsing a report. `value` is `null` for a well-formed report
 * of an event type this server does not know: it is ignored rather than
 * rejected, so an older server never errors on a newer client.
 */
export type ParseViewEventResult =
  | { readonly ok: true; readonly value: ViewEventInput | null }
  | { readonly ok: false; readonly error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isViewEventType(value: string): value is ViewEventType {
  return (VIEW_EVENT_TYPES as readonly string[]).includes(value);
}

/** Parse and validate an untrusted report body into a {@link ViewEventInput}. */
export function parseViewEvent(raw: unknown): ParseViewEventResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const { token, clipId, type } = raw as Record<string, unknown>;

  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > TOKEN_MAX_LENGTH
  ) {
    return { ok: false, error: "token must be a share token" };
  }
  if (typeof clipId !== "string" || !UUID_RE.test(clipId)) {
    return { ok: false, error: "clipId must be a valid clip id" };
  }
  if (typeof type !== "string") {
    return { ok: false, error: "type must be a string" };
  }
  if (!isViewEventType(type)) return { ok: true, value: null };

  return { ok: true, value: { token, clipId, type } };
}
