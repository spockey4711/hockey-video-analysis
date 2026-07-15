/**
 * Server-side session lifecycle, backed by the `sessions` table. A session is
 * created at login, validated on each request from the cookie token, and
 * deleted at logout or on expiry. Sessions have a fixed lifetime (no sliding
 * renewal) so validation never needs to write a cookie mid-render.
 */
import "server-only";
import { eq, lte } from "drizzle-orm";

import { SESSION_DURATION_MS } from "./config";
import { generateSessionToken, hashSessionToken } from "./tokens";

import { db } from "@/lib/db";
import { coaches, sessions } from "@/lib/db/schema";

/** The authenticated coach, minus the password hash - safe to pass around. */
export interface SessionCoach {
  id: string;
  email: string;
  name: string;
}

/** A validated session paired with its coach. */
export interface ActiveSession {
  token: string;
  expiresAt: Date;
  coach: SessionCoach;
}

/** True once `expiresAt` has passed relative to `now`. */
export function isSessionExpired(
  expiresAt: Date,
  now: Date = new Date(),
): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/**
 * Create a persistent session for a coach and return the raw token to set as a
 * cookie. Only the token's hash is stored, never the raw value.
 */
export async function createSession(coachId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({
    id: hashSessionToken(token),
    coachId,
    expiresAt,
  });
  return { token, expiresAt };
}

/**
 * Resolve a raw cookie token to its coach, or `null` if the token is unknown or
 * expired. An expired session is deleted opportunistically so the table does
 * not accumulate dead rows.
 */
export async function validateSessionToken(
  token: string,
): Promise<ActiveSession | null> {
  const sessionId = hashSessionToken(token);
  const row = await db
    .select({
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
  if (!found) return null;

  if (isSessionExpired(found.expiresAt)) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return {
    token,
    expiresAt: found.expiresAt,
    coach: { id: found.coachId, email: found.email, name: found.name },
  };
}

/** Delete a single session (logout). No-op if the token is already gone. */
export async function invalidateSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashSessionToken(token)));
}

/** Delete every session for a coach (e.g. after a password change). */
export async function invalidateAllSessions(coachId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.coachId, coachId));
}

/** Purge sessions that have already expired. Safe to call from a cron/route. */
export async function deleteExpiredSessions(
  now: Date = new Date(),
): Promise<void> {
  await db.delete(sessions).where(lte(sessions.expiresAt, now));
}
