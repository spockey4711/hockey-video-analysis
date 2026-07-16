/**
 * Server-side reads for the per-player clip share link (P0-11).
 *
 * A player's secret link is keyed by their `players.share_token` (unlike the
 * team link, whose secret is an env var - see the P0-10 token guard). The link
 * shows two kinds of ready clip: every `team`-visible clip (the same set the
 * team link shows) plus this player's own `single` clips - those whose tag is
 * linked to the player via `tag_players`. Another player's `single` clips are
 * never selected, so a per-player link can only ever reach what that player may
 * see (ADR/CLAUDE.md: login-free surfaces must not leak). This mirrors the
 * reachability rule already enforced for clip comments
 * ({@link canShareTokenReachClip}).
 */
import "server-only";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { clips, games, players, tagPlayers, tags } from "@/lib/db/schema";

/** The player a share token resolves to; just the id the clip query needs. */
export interface SharePlayer {
  readonly id: string;
}

/** One ready clip on a player's link, joined with the tag and game it came from. */
export interface PlayerClipRow {
  readonly id: string;
  readonly tagType: string;
  readonly startS: number;
  /** Present once the worker reports the clip `ready`; the query filters nulls out. */
  readonly outputPath: string;
  readonly gameTitle: string;
  readonly gameOpponent: string | null;
}

/**
 * Resolve a share token to its player, or `undefined` when no player carries it
 * (an unknown or empty token). The route turns `undefined` into a 404, so a
 * leaked-but-wrong link never confirms which tokens exist. An empty candidate is
 * rejected without touching the database.
 */
export async function getPlayerByShareToken(
  token: string,
): Promise<SharePlayer | undefined> {
  if (token.length === 0) return undefined;

  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.shareToken, token))
    .limit(1);
  return player;
}

/**
 * List every ready clip on a player's link: all `team`-visible clips plus that
 * player's own `single` clips, newest game first then by game-time within a game
 * so the playlist reads as a chronological session (empty when none). The
 * `single` set is scoped to `playerId` through `tag_players`, so no other
 * player's private clips can appear.
 */
export async function listReadyClipsForPlayer(
  playerId: string,
): Promise<PlayerClipRow[]> {
  const playerTagIds = db
    .select({ tagId: tagPlayers.tagId })
    .from(tagPlayers)
    .where(eq(tagPlayers.playerId, playerId));

  const rows = await db
    .select({
      id: clips.id,
      tagType: tags.type,
      startS: tags.startS,
      outputPath: clips.outputPath,
      gameTitle: games.title,
      gameOpponent: games.opponent,
    })
    .from(clips)
    .innerJoin(tags, eq(clips.tagId, tags.id))
    .innerJoin(games, eq(tags.gameId, games.id))
    .where(
      and(
        eq(clips.status, "ready"),
        or(
          eq(tags.visibility, "team"),
          and(eq(tags.visibility, "single"), inArray(tags.id, playerTagIds)),
        ),
      ),
    )
    .orderBy(desc(games.playedOn), asc(tags.startS));

  // `output_path` is nullable in the schema; a `ready` clip always has one, but
  // narrow defensively so a malformed row can never reach the player as a null src.
  return rows.flatMap((row) =>
    row.outputPath === null ? [] : [{ ...row, outputPath: row.outputPath }],
  );
}
