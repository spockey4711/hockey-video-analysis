/**
 * A tag's whole editable state with its row version (ADR 0013, Mac plan S3):
 * what the Mac merges field by field, so the tag routes answer it with `409`
 * when a write names a version the tag has moved past.
 */
import "server-only";

import { asc, eq } from "drizzle-orm";

import type { Visibility } from "@/features/tag-players/validation";
import { db } from "@/lib/db";
import { tagPlayers, tags } from "@/lib/db/schema";

/** Everything the coach edits on a tag, and the version it is at. */
export interface TagState {
  readonly id: string;
  readonly gameId: string;
  readonly type: string;
  readonly startS: number;
  readonly endS: number | null;
  readonly visibility: Visibility;
  /** The linked players, sorted so equal sets compare equal. */
  readonly playerIds: readonly string[];
  readonly version: number;
}

/** The result of a write that may name the version it started from. */
export type TagWriteOutcome<T> =
  | { readonly status: "done"; readonly value: T }
  | { readonly status: "not-found" }
  | { readonly status: "conflict"; readonly current: TagState };

type Executor = Pick<typeof db, "select">;

/** Read a tag's state, or `null` when no such tag exists. */
export async function readTagState(
  tagId: string,
  executor: Executor = db,
): Promise<TagState | null> {
  const [tag] = await executor
    .select({
      id: tags.id,
      gameId: tags.gameId,
      type: tags.type,
      startS: tags.startS,
      endS: tags.endS,
      visibility: tags.visibility,
      version: tags.version,
    })
    .from(tags)
    .where(eq(tags.id, tagId))
    .limit(1);
  if (!tag) return null;
  const links = await executor
    .select({ playerId: tagPlayers.playerId })
    .from(tagPlayers)
    .where(eq(tagPlayers.tagId, tagId))
    .orderBy(asc(tagPlayers.playerId));
  return {
    id: tag.id,
    gameId: tag.gameId,
    type: tag.type,
    startS: tag.startS,
    endS: tag.endS,
    visibility: tag.visibility,
    playerIds: links.map((link) => link.playerId),
    version: tag.version,
  };
}
