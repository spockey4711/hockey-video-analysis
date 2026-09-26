/**
 * Database access for tag capture (P0-6). Thin wrapper over the `tags` table so
 * the route handler stays readable and the SQL lives in one place.
 */
import "server-only";

import { eq } from "drizzle-orm";

import type { TagInput } from "./validation";

import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";

/** The persisted tag returned to the client after capture. */
export interface CreatedTag {
  id: string;
  gameId: string;
  type: string;
  startS: number;
  endS: number | null;
  visibility: "team" | "single";
  source: "manual" | "suggestion";
  authorId: string | null;
  /** The row version (ADR 0013), which a later edit may name in `If-Match`. */
  version: number;
  createdAt: Date;
}

/**
 * What inserting a tag did: `created` it, found it already `stored` (a retry
 * of a create with the same client id), or found the client id `taken` by a
 * tag of another game.
 */
export type InsertTagOutcome =
  | { readonly status: "created"; readonly tag: CreatedTag }
  | { readonly status: "stored"; readonly tag: CreatedTag }
  | { readonly status: "taken" };

const returning = {
  id: tags.id,
  gameId: tags.gameId,
  type: tags.type,
  startS: tags.startS,
  endS: tags.endS,
  visibility: tags.visibility,
  source: tags.source,
  authorId: tags.authorId,
  version: tags.version,
  createdAt: tags.createdAt,
} as const;

/**
 * Insert a captured tag. `source` is always `manual` here (hotkey capture);
 * `authorId` stamps the coach who captured it so parallel coaches stay
 * distinguishable. `visibility` defaults to `team` per the schema.
 *
 * A create with a client-made id (the Mac app, ADR 0013) is idempotent: when a
 * tag with that id already exists in the same game, it is returned as it is
 * now, so a retry after a lost answer never stores the tag twice. The stored
 * tag is not changed; later edits come as their own requests.
 */
export async function insertTag(
  input: TagInput & { authorId: string },
): Promise<InsertTagOutcome> {
  const inserted = await db
    .insert(tags)
    .values({
      ...(input.id === undefined ? {} : { id: input.id }),
      gameId: input.gameId,
      type: input.type,
      startS: input.startS,
      endS: input.endS,
      authorId: input.authorId,
      source: "manual",
    })
    .onConflictDoNothing({ target: tags.id })
    .returning(returning);
  if (inserted[0]) return { status: "created", tag: inserted[0] };

  const [stored] =
    input.id === undefined
      ? []
      : await db
          .select(returning)
          .from(tags)
          .where(eq(tags.id, input.id))
          .limit(1);
  if (stored && stored.gameId === input.gameId.toLowerCase()) {
    return { status: "stored", tag: stored };
  }
  return { status: "taken" };
}
