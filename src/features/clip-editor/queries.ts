/**
 * Server-side read for the clip editor (ADR 0011): every clip in one
 * collection with what the editor needs to trim it - its file, its tag window,
 * where the file really starts, the stored edit and its save version, how
 * long the game runs, so lengthening never reaches past its end, and the frame
 * rate of the chapter the clip starts in, so a frame step moves one frame.
 * Coach-only; the page authorizes before calling in.
 *
 * Unlike the share link, the editor lists members in every clip status: a clip
 * being re-cut after a lengthening stays in the list with its wait state.
 */
import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";

import type { EditorEntryRow } from "./entries";

import {
  gameChaptersField,
  readStoredEdit,
} from "@/features/clip-edits/queries";
import { resolveClipEnd } from "@/features/clips/cut/window";
import { getTagWindows } from "@/features/tag-windows/queries";
import { db } from "@/lib/db";
import {
  clips,
  collectionClips,
  gameSources,
  games,
  tags,
} from "@/lib/db/schema";
import { frameRateAt } from "@/lib/frame-step";

/**
 * The clips in `collectionId`, in the link's play order: newest game first,
 * then by game time (empty when none).
 */
export async function listEditorEntries(
  collectionId: string,
): Promise<EditorEntryRow[]> {
  const rows = await db
    .select({
      id: clips.id,
      status: clips.status,
      outputPath: clips.outputPath,
      cutStartS: clips.cutStartS,
      tagId: tags.id,
      tagType: tags.type,
      startS: tags.startS,
      endS: tags.endS,
      visibility: tags.visibility,
      gameTitle: games.title,
      gameOpponent: games.opponent,
      gameDurationS: sql<number>`(
        select coalesce(sum(${gameSources.durationS}), 0)
        from ${gameSources}
        where ${gameSources.gameId} = ${games.id}
      )`.mapWith(Number),
      chapters: gameChaptersField(games.id),
      edit: collectionClips.edit,
      version: collectionClips.editVersion,
    })
    .from(collectionClips)
    .innerJoin(clips, eq(clips.id, collectionClips.clipId))
    .innerJoin(tags, eq(tags.id, clips.tagId))
    .innerJoin(games, eq(games.id, tags.gameId))
    .where(eq(collectionClips.collectionId, collectionId))
    .orderBy(desc(games.playedOn), asc(tags.startS));

  const windows = await getTagWindows();
  return rows.map(({ endS, edit, visibility, chapters, ...row }) => ({
    ...row,
    frameRate: frameRateAt(chapters, row.startS),
    window: {
      startS: row.startS,
      endS: resolveClipEnd(row.startS, endS, row.tagType, windows),
    },
    isSingle: visibility === "single",
    edit: readStoredEdit(edit, `${collectionId}/${row.id}`),
  }));
}
