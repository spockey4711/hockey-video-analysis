/**
 * The anonymous viewer key behind "unique viewers" on a collection link
 * (ADR 0009). The server hashes the request's IP address and user agent
 * together with the collection id under a random salt that exists only in this
 * process's memory and only for one UTC day. Neither the IP address nor the user
 * agent is stored anywhere, and nothing is written to the viewer's device.
 *
 * Because the salt is replaced at the day boundary and never persisted, a key
 * cannot be recomputed from an IP address once its day has passed: it only
 * tells two events of the same day apart. Including the collection id means the
 * same viewer gets unrelated keys on different collections, so keys cannot be
 * joined across links either.
 */
import "server-only";
import { createHmac, randomBytes } from "node:crypto";

/** Bytes of randomness in a daily salt. */
const SALT_BYTES = 32;

/** The UTC calendar day of `now` as `YYYY-MM-DD`, the bucket a salt and an event belong to. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Hands out the salt of a day, keeping at most the current day's in memory. */
export interface DailySaltStore {
  saltFor(day: string): Buffer;
}

/**
 * A salt store that holds exactly one salt: asking for a new day replaces (and
 * so forgets) the previous day's salt. `generate` is injectable for tests.
 */
export function createDailySaltStore(
  generate: () => Buffer = () => randomBytes(SALT_BYTES),
): DailySaltStore {
  let current: { readonly day: string; readonly salt: Buffer } | undefined;
  return {
    saltFor(day) {
      if (current?.day !== day) current = { day, salt: generate() };
      return current.salt;
    },
  };
}

// One store per server process. Kept on `globalThis` so development hot reloads
// do not mint a fresh salt (and double-count every viewer) on each edit.
const globalForSalt = globalThis as unknown as {
  viewSaltStore?: DailySaltStore;
};

/** The process-wide salt store. */
export function dailySaltStore(): DailySaltStore {
  globalForSalt.viewSaltStore ??= createDailySaltStore();
  return globalForSalt.viewSaltStore;
}

/** What identifies a viewer for one day on one collection; never stored. */
export interface ViewerFingerprint {
  readonly ip: string;
  readonly userAgent: string;
  readonly collectionId: string;
}

/**
 * The viewer key: HMAC-SHA256 of the fingerprint under the day's salt, hex
 * encoded. Fields are NUL-separated so no two different fingerprints can
 * concatenate to the same input.
 */
export function viewerKey(
  salt: Buffer,
  fingerprint: ViewerFingerprint,
): string {
  return createHmac("sha256", salt)
    .update(
      [fingerprint.ip, fingerprint.userAgent, fingerprint.collectionId].join(
        "\0",
      ),
    )
    .digest("hex");
}

/**
 * The client's IP address as the reverse proxy reports it: `X-Real-IP` (set by
 * nginx from the connection, so a client cannot forge it), else the first
 * `X-Forwarded-For` entry, else an empty string. The value only ever feeds
 * {@link viewerKey}; a forged header can at worst inflate the unique count.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}
