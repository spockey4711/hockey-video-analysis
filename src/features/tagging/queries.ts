/**
 * Database access for tag capture (P0-6). Thin wrapper over the `tags` table so
 * the route handler stays readable and the SQL lives in one place.
 */
import "server-only";

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
  createdAt: Date;
}

/**
 * Insert a captured tag. `source` is always `manual` here (hotkey capture);
 * `authorId` stamps the coach who captured it so parallel coaches stay
 * distinguishable. `visibility` defaults to `team` per the schema.
 */
export async function insertTag(
  input: TagInput & { authorId: string },
): Promise<CreatedTag> {
  const rows = await db
    .insert(tags)
    .values({
      gameId: input.gameId,
      type: input.type,
      startS: input.startS,
      endS: input.endS,
      authorId: input.authorId,
      source: "manual",
    })
    .returning({
      id: tags.id,
      gameId: tags.gameId,
      type: tags.type,
      startS: tags.startS,
      endS: tags.endS,
      visibility: tags.visibility,
      source: tags.source,
      authorId: tags.authorId,
      createdAt: tags.createdAt,
    });
  return rows[0];
}
