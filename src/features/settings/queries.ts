/**
 * Database access for the settings flow. Thin wrappers over the `coaches` and
 * `sessions` tables so the server action stays readable and the SQL lives in one
 * place.
 */
import "server-only";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { coaches, sessions } from "@/lib/db/schema";

/** Read a coach's stored password hash, or `undefined` if the row is gone. */
export async function getCoachPasswordHash(
  coachId: string,
): Promise<string | undefined> {
  const rows = await db
    .select({ passwordHash: coaches.passwordHash })
    .from(coaches)
    .where(eq(coaches.id, coachId))
    .limit(1);
  return rows[0]?.passwordHash;
}

/**
 * Replace a coach's password hash and revoke every one of their sessions in one
 * transaction, so a new password can never land while devices signed in with
 * the old one stay logged in (`updatedAt` bumps via the column's `$onUpdate`).
 * The caller starts a fresh session for the current device afterwards.
 */
export async function replacePasswordAndRevokeSessions(
  coachId: string,
  passwordHash: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(coaches)
      .set({ passwordHash })
      .where(eq(coaches.id, coachId));
    await tx.delete(sessions).where(eq(sessions.coachId, coachId));
  });
}
