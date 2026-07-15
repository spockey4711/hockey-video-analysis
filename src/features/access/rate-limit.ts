/**
 * A minimal fixed-window rate limiter for the login endpoint, to blunt password
 * guessing (per the auth flavor's "rate limiting and lockout" bar). State is an
 * in-process map: correct for the single-node self-hosted target, and it fails
 * open across a restart rather than locking anyone out. A multi-instance deploy
 * should back this with a shared store (Redis) instead.
 */
export interface RateLimitResult {
  limited: boolean;
  /** Milliseconds until the window resets, when `limited` is true. */
  retryAfterMs: number;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Check whether `key` is currently rate-limited, without counting this call as
 * an attempt. Call `recordFailure` on a failed login and `reset` on a success.
 */
export function checkRateLimit(
  key: string,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    return { limited: false, retryAfterMs: 0 };
  }
  if (bucket.count >= MAX_ATTEMPTS) {
    return { limited: true, retryAfterMs: bucket.resetAt - now };
  }
  return { limited: false, retryAfterMs: 0 };
}

/** Record one failed attempt against `key`, opening a window if none is active. */
export function recordFailure(key: string, now: number = Date.now()): void {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.count += 1;
}

/** Clear the counter for `key` (e.g. after a successful login). */
export function reset(key: string): void {
  buckets.delete(key);
}

/** Test-only: drop all counters so cases do not bleed into each other. */
export function _resetAll(): void {
  buckets.clear();
}
