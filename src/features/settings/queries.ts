/**
 * Database access for the settings flow. Thin wrappers over the `coaches` table
 * so the server action stays readable and the SQL lives in one place.
 */
import "server-only";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { coaches } from "@/lib/db/schema";

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

/** Replace a coach's password hash (`updatedAt` bumps via the column's `$onUpdate`). */
export async function updateCoachPassword(
  coachId: string,
  passwordHash: string,
): Promise<void> {
  await db.update(coaches).set({ passwordHash }).where(eq(coaches.id, coachId));
}
