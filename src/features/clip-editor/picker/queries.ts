/**
 * Server-side read for the clip editor's picker (ADR 0011): every ready clip
 * with what its filters need - the game, the tag type and the players the
 * clip's tag is linked to - plus the team's players to name them, marked
 * against the clips already in the collection. Coach-only; the route
 * authorizes before calling in.
 */
import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";

import { toPickerData, type PickerData } from "./picker";

import { db } from "@/lib/db";
import {
  clips,
  collectionClips,
  collections,
  games,
  players,
  tagPlayers,
  tags,
} from "@/lib/db/schema";

/**
 * The picker for `collectionId`: every ready clip, in the link's play order
 * (newest game first, then by game time), with each filter's choices. Both
 * `team` and `single` clips are offered, as in the collection's checklist, so
 * a coach can knowingly add a player-specific clip. `null` when the collection
 * does not exist.
 */
export async function getPickerData(
  collectionId: string,
): Promise<PickerData | null> {
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);
  if (!collection) return null;

  const [rows, roster, members] = await Promise.all([
    db
      .select({
        id: clips.id,
        gameId: games.id,
        gameTitle: games.title,
        gameOpponent: games.opponent,
        tagType: tags.type,
        startS: tags.startS,
        visibility: tags.visibility,
        playerIds: sql<string[]>`array(
          select ${tagPlayers.playerId}::text
          from ${tagPlayers}
          where ${tagPlayers.tagId} = ${tags.id}
        )`,
      })
      .from(clips)
      .innerJoin(tags, eq(tags.id, clips.tagId))
      .innerJoin(games, eq(games.id, tags.gameId))
      .where(eq(clips.status, "ready"))
      .orderBy(desc(games.playedOn), asc(tags.startS)),
    db
      .select({
        id: players.id,
        name: players.name,
        jerseyNumber: players.jerseyNumber,
      })
      .from(players),
    db
      .select({ clipId: collectionClips.clipId })
      .from(collectionClips)
      .where(eq(collectionClips.collectionId, collectionId)),
  ]);

  return toPickerData(
    rows.map(({ visibility, ...row }) => ({
      ...row,
      isSingle: visibility === "single",
    })),
    roster,
    new Set(members.map((member) => member.clipId)),
  );
}
