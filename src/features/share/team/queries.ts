/**
 * Server-side read for the team clip share link (P0-10): every team-visible clip
 * that is ready to watch.
 *
 * A clip is on the team link when its tag's `visibility` is `team` and the cut
 * job has finished (`status = 'ready'`, so `output_path` is set). Player-specific
 * (`single`) clips are excluded here and only ever surface on a per-player link
 * (P0-11), so the team link can never leak one player's private clips. The rows
 * are ordered newest game first, then by game-time within a game, so the
 * playlist reads as a chronological session.
 */
import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { clips, games, tags } from "@/lib/db/schema";

/** One ready, team-visible clip joined with the tag and game it came from. */
export interface TeamClipRow {
  readonly id: string;
  readonly tagType: string;
  readonly startS: number;
  /** Present once the worker reports the clip `ready`; the query filters nulls out. */
  readonly outputPath: string;
  readonly gameTitle: string;
  readonly gameOpponent: string | null;
}

/** List every ready, team-visible clip for the team playlist (empty when none). */
export async function listReadyTeamClips(): Promise<TeamClipRow[]> {
  const rows = await db
    .select({
      id: clips.id,
      tagType: tags.type,
      startS: tags.startS,
      outputPath: clips.outputPath,
      gameTitle: games.title,
      gameOpponent: games.opponent,
      playedOn: games.playedOn,
    })
    .from(clips)
    .innerJoin(tags, eq(clips.tagId, tags.id))
    .innerJoin(games, eq(tags.gameId, games.id))
    .where(and(eq(clips.status, "ready"), eq(tags.visibility, "team")))
    .orderBy(desc(games.playedOn), asc(tags.startS));

  // `output_path` is nullable in the schema; a `ready` clip always has one, but
  // narrow defensively so a malformed row can never reach the player as a null src.
  return rows.flatMap((row) =>
    row.outputPath === null
      ? []
      : [
          {
            id: row.id,
            tagType: row.tagType,
            startS: row.startS,
            outputPath: row.outputPath,
            gameTitle: row.gameTitle,
            gameOpponent: row.gameOpponent,
          },
        ],
  );
}
