/**
 * Clip lifecycle helpers (P0-9). A clip is a cut job handed to the
 * hockey-video-pipeline worker through the shared DB queue (ADR 0003): the app
 * inserts a `pending` row, the worker moves it `processing -> ready | failed`.
 * These pure helpers classify that lifecycle so the queries and route agree on
 * what counts as a live job; they hold no database or request state.
 */

/** The clip statuses, in lifecycle order, mirroring `clipStatusEnum`. */
export const CLIP_STATUSES = [
  "pending",
  "processing",
  "ready",
  "failed",
] as const;

export type ClipStatus = (typeof CLIP_STATUSES)[number];

/** Type guard for an untrusted string that should be a clip status. */
export function isClipStatus(value: unknown): value is ClipStatus {
  return (
    typeof value === "string" &&
    (CLIP_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Whether a clip still occupies the queue for its tag. A `pending`,
 * `processing` or `ready` clip is a live cut job (or its finished output), so a
 * fresh enqueue would only duplicate the worker's work. `failed` is terminal
 * and retryable, so it never blocks re-enqueuing. This is the app-level guard
 * against double-cutting a tag; the frozen schema (P0-1) carries no unique
 * constraint to lean on.
 */
export function isActiveClipStatus(status: ClipStatus): boolean {
  return status !== "failed";
}
