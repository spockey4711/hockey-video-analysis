/**
 * Database access for the access flow. Thin wrappers over the `coaches` table so
 * the server actions stay readable and the SQL lives in one place.
 */
import "server-only";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { coaches } from "@/lib/db/schema";

/** Look up a coach by normalized email, returning the fields login needs. */
export async function findCoachByEmail(
  email: string,
): Promise<{ id: string; passwordHash: string } | undefined> {
  const rows = await db
    .select({ id: coaches.id, passwordHash: coaches.passwordHash })
    .from(coaches)
    .where(eq(coaches.email, email))
    .limit(1);
  return rows[0];
}

/** Create a coach account. The unique index on `email` guards against races. */
export async function createCoach(input: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<{ id: string }> {
  const rows = await db
    .insert(coaches)
    .values(input)
    .returning({ id: coaches.id });
  return rows[0];
}
