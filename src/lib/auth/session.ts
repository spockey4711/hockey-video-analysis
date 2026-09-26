/**
 * Server-side session lifecycle, backed by the `sessions` table. A session is
 * created at login, validated on each request from its token, and deleted at
 * logout, on removal under Einstellungen > Geräte, or on expiry.
 *
 * Two kinds exist (ADR 0005, ADR 0013). A `web` session rides in the cookie and
 * has a fixed lifetime, so validation never needs to write a cookie mid-render.
 * A `device` session is the Mac app's bearer token and lives until it goes
 * unused for `DEVICE_SESSION_IDLE_MS`. Each kind is only accepted over its own
 * transport, so a device token set as a cookie opens no page.
 */
import "server-only";
import { and, desc, eq, gt, lte, ne } from "drizzle-orm";

import {
  DEVICE_SESSION_IDLE_MS,
  LAST_SEEN_INTERVAL_MS,
  SESSION_DURATION_MS,
} from "./config";
import { generateSessionToken, hashSessionToken } from "./tokens";

import { db } from "@/lib/db";
import { coaches, sessions } from "@/lib/db/schema";

/** How a session was started: a browser cookie or the Mac app's bearer token. */
export type SessionKind = (typeof sessions.$inferSelect)["kind"];

/** The authenticated coach, minus the password hash - safe to pass around. */
export interface SessionCoach {
  id: string;
  email: string;
  name: string;
}

/** A validated session paired with its coach. Never carries the raw token. */
export interface ActiveSession {
  /** The row's public handle, the only session id that reaches a browser. */
  publicId: string;
  kind: SessionKind;
  expiresAt: Date;
  coach: SessionCoach;
}

/** What a new session records about the device that started it. */
export interface NewSession {
  kind: SessionKind;
  /** A coarse label ("Chrome auf macOS") or the name the Mac sent. */
  deviceName: string;
}

/** True once `expiresAt` has passed relative to `now`. */
export function isSessionExpired(
  expiresAt: Date,
  now: Date = new Date(),
): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/**
 * When a session of `kind` started or last used at `now` expires: a web
 * session 30 days after login, a device session 180 days after its last use.
 */
export function sessionExpiresAt(kind: SessionKind, now: Date): Date {
  const lifetime =
    kind === "device" ? DEVICE_SESSION_IDLE_MS : SESSION_DURATION_MS;
  return new Date(now.getTime() + lifetime);
}

/**
 * True when a use at `now` should be written back: at most once per
 * `LAST_SEEN_INTERVAL_MS`, so most validations stay a single read.
 */
export function shouldRecordUse(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() >= LAST_SEEN_INTERVAL_MS;
}

/**
 * Create a persistent session for a coach and return the raw token to hand to
 * the client. Only the token's hash is stored, never the raw value.
 */
export async function createSession(
  coachId: string,
  { kind, deviceName }: NewSession,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = sessionExpiresAt(kind, now);
  await db.insert(sessions).values({
    id: hashSessionToken(token),
    coachId,
    kind,
    deviceName,
    lastSeenAt: now,
    expiresAt,
  });
  return { token, expiresAt };
}

/**
 * Resolve a raw token presented over the transport of `kind` to its session,
 * or `null` if the token is unknown, of the other kind, or expired. An expired
 * session is deleted opportunistically so the table does not accumulate dead
 * rows. A use is recorded at most once an hour, and it renews a device
 * session's idle expiry.
 */
export async function validateSessionToken(
  token: string,
  kind: SessionKind,
  now: Date = new Date(),
): Promise<ActiveSession | null> {
  const sessionId = hashSessionToken(token);
  const row = await db
    .select({
      publicId: sessions.publicId,
      kind: sessions.kind,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
      coachId: coaches.id,
      email: coaches.email,
      name: coaches.name,
    })
    .from(sessions)
    .innerJoin(coaches, eq(sessions.coachId, coaches.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const found = row[0];
  // A token of the other kind is refused but left alone: it is still valid
  // over its own transport.
  if (!found || found.kind !== kind) return null;

  if (isSessionExpired(found.expiresAt, now)) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  let expiresAt = found.expiresAt;
  if (shouldRecordUse(found.lastSeenAt, now)) {
    if (kind === "device") expiresAt = sessionExpiresAt(kind, now);
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt })
      .where(eq(sessions.id, sessionId));
  }

  return {
    publicId: found.publicId,
    kind: found.kind,
    expiresAt,
    coach: { id: found.coachId, email: found.email, name: found.name },
  };
}

/** Delete a single session (logout). No-op if the token is already gone. */
export async function invalidateSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashSessionToken(token)));
}

/**
 * Delete every session for a coach, browsers and the Mac alike (e.g. after a
 * password change).
 */
export async function invalidateAllSessions(coachId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.coachId, coachId));
}

/** One of a coach's sessions as Einstellungen > Geräte lists it. */
export interface SessionSummary {
  publicId: string;
  kind: SessionKind;
  deviceName: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

/** A coach's live sessions, the most recently used first. */
export async function listSessions(
  coachId: string,
  now: Date = new Date(),
): Promise<SessionSummary[]> {
  return db
    .select({
      publicId: sessions.publicId,
      kind: sessions.kind,
      deviceName: sessions.deviceName,
      lastSeenAt: sessions.lastSeenAt,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(and(eq(sessions.coachId, coachId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.lastSeenAt), desc(sessions.createdAt));
}

/**
 * Sign one of a coach's sessions out by its public handle. Scoped to the coach,
 * so a handle of someone else's session removes nothing. True when a session
 * was removed.
 */
export async function revokeSession(
  coachId: string,
  publicId: string,
): Promise<boolean> {
  const removed = await db
    .delete(sessions)
    .where(and(eq(sessions.coachId, coachId), eq(sessions.publicId, publicId)))
    .returning({ publicId: sessions.publicId });
  return removed.length > 0;
}

/**
 * Sign out every session of a coach except the one with `keepPublicId` (this
 * browser), the Mac app included. Returns how many were removed.
 */
export async function revokeOtherSessions(
  coachId: string,
  keepPublicId: string,
): Promise<number> {
  const removed = await db
    .delete(sessions)
    .where(
      and(eq(sessions.coachId, coachId), ne(sessions.publicId, keepPublicId)),
    )
    .returning({ publicId: sessions.publicId });
  return removed.length;
}

/** Purge sessions that have already expired. Safe to call from a cron/route. */
export async function deleteExpiredSessions(
  now: Date = new Date(),
): Promise<void> {
  await db.delete(sessions).where(lte(sessions.expiresAt, now));
}
