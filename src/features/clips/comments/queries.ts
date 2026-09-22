/**
 * Database access for clip comments (P1-2). Thin wrappers over the `comments`
 * table so the route handler stays readable and the SQL lives in one place.
 *
 * Access model: a comment is read/written either by a signed-in coach or by a
 * viewer holding a `shareToken` that can actually reach the clip. The
 * reachability check ({@link canShareTokenReachClip}) mirrors the share rules
 * (ADR: login-free surfaces must not leak): the team token reaches exactly the
 * `team`-visible clips the team link lists; a player token reaches every
 * `team`-visible clip and only those `single` clips whose tag is linked to that
 * token's player - never another player's `single` clips.
 */
import "server-only";
import { and, asc, eq } from "drizzle-orm";

import type { CommentInput } from "./validation";

import { verifyTeamShareToken } from "@/features/share/team/token";
import { db } from "@/lib/db";
import { clips, comments, players, tagPlayers, tags } from "@/lib/db/schema";

/** A persisted comment on a clip. */
export interface CommentRow {
  id: string;
  clipId: string;
  author: string;
  body: string;
  createdAt: Date;
}

const commentColumns = {
  id: comments.id,
  clipId: comments.clipId,
  author: comments.author,
  body: comments.body,
  createdAt: comments.createdAt,
} as const;

/** Whether a clip exists, so the route can answer 404 rather than a bare list. */
export async function clipExists(clipId: string): Promise<boolean> {
  const rows = await db
    .select({ id: clips.id })
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);
  return rows.length > 0;
}

/**
 * List a clip's comments oldest first, so they read as a thread. Returns an
 * empty array when the clip has no comments (or does not exist - the caller
 * checks {@link clipExists} first when it needs to distinguish the two).
 */
export async function listCommentsForClip(
  clipId: string,
): Promise<CommentRow[]> {
  return db
    .select(commentColumns)
    .from(comments)
    .where(eq(comments.clipId, clipId))
    .orderBy(asc(comments.createdAt));
}

/**
 * Insert a comment on a clip and return the persisted row. The caller must have
 * already authorized the write (coach session or a clip-reaching share token);
 * a missing `clipId` raises a foreign-key violation the route turns into a 404.
 */
export async function addCommentToClip(
  clipId: string,
  input: CommentInput,
): Promise<CommentRow> {
  const inserted = await db
    .insert(comments)
    .values({ clipId, author: input.author, body: input.body })
    .returning(commentColumns);
  return inserted[0];
}

/** Who holds a share token: the team link, or one player's link. */
type ShareTokenHolder =
  | { readonly kind: "team" }
  | { readonly kind: "player"; readonly playerId: string };

async function resolveShareToken(
  shareToken: string,
): Promise<ShareTokenHolder | null> {
  if (verifyTeamShareToken(shareToken)) return { kind: "team" };
  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.shareToken, shareToken))
    .limit(1);
  return player ? { kind: "player", playerId: player.id } : null;
}

/**
 * Whether a `shareToken` may read and write comments on a given clip. The
 * token is either the team link's (`TEAM_SHARE_TOKEN`), which reaches exactly
 * the `team`-visible clips, or a player's `players.share_token`, which reaches
 * `team`-visible clips plus the `single` clips whose tag is linked to that
 * player. False for an unknown token, a missing clip, or a `single` clip the
 * token's holder may not see - so a share link never reaches beyond what it
 * may see.
 */
export async function canShareTokenReachClip(
  shareToken: string,
  clipId: string,
): Promise<boolean> {
  const holder = await resolveShareToken(shareToken);
  if (!holder) return false;

  const [clip] = await db
    .select({ tagId: clips.tagId, visibility: tags.visibility })
    .from(clips)
    .innerJoin(tags, eq(clips.tagId, tags.id))
    .where(eq(clips.id, clipId))
    .limit(1);
  if (!clip) return false;

  if (clip.visibility === "team") return true;
  if (holder.kind === "team") return false;

  const [link] = await db
    .select({ playerId: tagPlayers.playerId })
    .from(tagPlayers)
    .where(
      and(
        eq(tagPlayers.tagId, clip.tagId),
        eq(tagPlayers.playerId, holder.playerId),
      ),
    )
    .limit(1);
  return Boolean(link);
}
