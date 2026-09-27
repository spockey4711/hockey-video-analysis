/**
 * Server-side reads and writes for plan vs reality: the tagged moments linked
 * to a tactics scene as its executions ("Ausführungen"), each with how it
 * went (`scene_executions`). Coach-only, like the rest of the tactics board;
 * nothing here is read by a share link.
 *
 * An execution links a tag, and the clip it plays is the tag's newest clip,
 * the one the watch page shows as its current cut; the playlist plays it only
 * once it is ready.
 */
import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import {
  compareExecutions,
  defaultOutcome,
  type ExecutionOutcome,
  type ExecutionStats,
  executionStats,
} from "./outcome";

import { gameChaptersField } from "@/features/clip-edits/queries";
import { resolveClipEnd } from "@/features/clips/cut/window";
import type { ClipStatus } from "@/features/clips/status";
import { getTagWindows } from "@/features/tag-windows/queries";
import { tagHasType } from "@/features/tagging/type-filter";
import { db } from "@/lib/db";
import {
  clips,
  games,
  sceneExecutions,
  tacticsScenes,
  tags,
} from "@/lib/db/schema";
import { frameRateAt } from "@/lib/frame-step";

/** The goal tag type: a goal in an execution's window means it worked. */
const GOAL_TYPE = "goal";

/** The tag's current clip, as far as the executions need it. */
export interface ExecutionClip {
  readonly id: string;
  readonly status: ClipStatus;
  /** Where the cut file sits once `ready`; `null` before. */
  readonly outputPath: string | null;
  /** The game time at clip-file time 0, `null` until probed (ADR 0011). */
  readonly cutStartS: number | null;
}

/** One tagged moment as the executions and the picker list it. */
export interface ExecutionTag {
  readonly tagId: string;
  readonly tagType: string;
  /** The tag's further types (ADR 0016). */
  readonly extraTypes: readonly string[];
  readonly startS: number;
  /** The tag's window end, its own or its type's (never `null`). */
  readonly endS: number;
  readonly gameId: string;
  readonly gameTitle: string;
  readonly gameOpponent: string | null;
  readonly playedOn: string | null;
  /** The tag's newest clip, `null` when none was cut. */
  readonly clip: ExecutionClip | null;
}

/** One execution of a scene: the tagged moment and how it went. */
export interface SceneExecution extends ExecutionTag {
  readonly outcome: ExecutionOutcome;
  /** Frames per second where the clip starts, `null` when unknown. */
  readonly frameRate: number | null;
}

/** A game the picker can narrow the tags to. */
export interface ExecutionGame {
  readonly id: string;
  readonly title: string;
  readonly opponent: string | null;
  readonly playedOn: string | null;
}

/** A scene a tag can be linked to, and how the link stands. */
export interface TagSceneChoice {
  readonly id: string;
  readonly name: string;
  /** How the tag's execution of the scene went, `null` when not linked. */
  readonly outcome: ExecutionOutcome | null;
}

/** The tag and game columns every execution read selects. */
const tagColumns = {
  tagId: tags.id,
  tagType: tags.type,
  extraTypes: tags.extraTypes,
  startS: tags.startS,
  endS: tags.endS,
  gameId: games.id,
  gameTitle: games.title,
  gameOpponent: games.opponent,
  playedOn: games.playedOn,
};

/** The newest clip of each tag, keyed by tag id (none for an uncut tag). */
async function newestClips(
  tagIds: readonly string[],
): Promise<Map<string, ExecutionClip>> {
  const byTag = new Map<string, ExecutionClip>();
  if (tagIds.length === 0) return byTag;
  const rows = await db
    .select({
      tagId: clips.tagId,
      id: clips.id,
      status: clips.status,
      outputPath: clips.outputPath,
      cutStartS: clips.cutStartS,
    })
    .from(clips)
    .where(inArray(clips.tagId, [...tagIds]))
    .orderBy(desc(clips.createdAt));
  for (const { tagId, ...clip } of rows) {
    if (!byTag.has(tagId)) byTag.set(tagId, clip);
  }
  return byTag;
}

/** How many executions each scene has, by outcome; a scene without any is absent. */
export async function listExecutionStats(): Promise<
  Map<string, ExecutionStats>
> {
  const rows = await db
    .select({
      sceneId: sceneExecutions.sceneId,
      outcome: sceneExecutions.outcome,
      n: count(),
    })
    .from(sceneExecutions)
    .groupBy(sceneExecutions.sceneId, sceneExecutions.outcome);
  const outcomes = new Map<string, ExecutionOutcome[]>();
  for (const { sceneId, outcome, n } of rows) {
    const list = outcomes.get(sceneId) ?? [];
    for (let i = 0; i < n; i += 1) list.push(outcome);
    outcomes.set(sceneId, list);
  }
  return new Map(
    [...outcomes].map(([sceneId, list]) => [sceneId, executionStats(list)]),
  );
}

/**
 * A scene's executions in play order (see `compareExecutions`), each with its
 * tag's window, game and newest clip.
 */
export async function listSceneExecutions(
  sceneId: string,
): Promise<SceneExecution[]> {
  const rows = await db
    .select({
      ...tagColumns,
      outcome: sceneExecutions.outcome,
      chapters: gameChaptersField(games.id),
    })
    .from(sceneExecutions)
    .innerJoin(tags, eq(sceneExecutions.tagId, tags.id))
    .innerJoin(games, eq(tags.gameId, games.id))
    .where(eq(sceneExecutions.sceneId, sceneId));
  const [windows, clipsByTag] = await Promise.all([
    getTagWindows(),
    newestClips(rows.map((row) => row.tagId)),
  ]);
  return rows
    .map(({ chapters, ...row }) => ({
      ...row,
      endS: resolveClipEnd(row.startS, row.endS, row.tagType, windows),
      clip: clipsByTag.get(row.tagId) ?? null,
      frameRate: frameRateAt(chapters, row.startS),
    }))
    .sort(compareExecutions);
}

/**
 * The tagged moments the picker offers, in play order: every tag that counts
 * as `type` (its main or a further type, ADR 0016), or of every type when it
 * is `null`, in `gameId`'s game or in every game.
 */
export async function listExecutionCandidates(filter: {
  readonly type: string | null;
  readonly gameId: string | null;
}): Promise<ExecutionTag[]> {
  const conditions = [
    filter.type === null ? undefined : tagHasType(filter.type),
    filter.gameId === null ? undefined : eq(tags.gameId, filter.gameId),
  ];
  const rows = await db
    .select(tagColumns)
    .from(tags)
    .innerJoin(games, eq(tags.gameId, games.id))
    .where(and(...conditions));
  const [windows, clipsByTag] = await Promise.all([
    getTagWindows(),
    newestClips(rows.map((row) => row.tagId)),
  ]);
  return rows
    .map((row) => ({
      ...row,
      endS: resolveClipEnd(row.startS, row.endS, row.tagType, windows),
      clip: clipsByTag.get(row.tagId) ?? null,
    }))
    .sort(compareExecutions);
}

/** The ids of the tags already linked to a scene. */
export async function listLinkedTagIds(sceneId: string): Promise<Set<string>> {
  const rows = await db
    .select({ tagId: sceneExecutions.tagId })
    .from(sceneExecutions)
    .where(eq(sceneExecutions.sceneId, sceneId));
  return new Set(rows.map((row) => row.tagId));
}

/** Every game with at least one tag, newest first, for the picker's filter. */
export async function listExecutionGames(): Promise<ExecutionGame[]> {
  return db
    .selectDistinct({
      id: games.id,
      title: games.title,
      opponent: games.opponent,
      playedOn: games.playedOn,
    })
    .from(games)
    .innerJoin(tags, eq(tags.gameId, games.id))
    .orderBy(desc(games.playedOn), asc(games.title), asc(games.id));
}

/**
 * Link tags to a scene as its executions, each starting with the outcome
 * {@link defaultOutcome} derives from the goal tags of its game - every tag
 * that counts as a goal, so a corner that ended in a goal starts as a success. A tag that
 * is already linked keeps its link and outcome, and an unknown tag id is
 * skipped. Returns how many links were added, or `null` when the scene does
 * not exist.
 */
export async function linkExecutions(
  sceneId: string,
  tagIds: readonly string[],
): Promise<number | null> {
  const windows = await getTagWindows();
  return db.transaction(async (tx) => {
    const [scene] = await tx
      .select({ id: tacticsScenes.id })
      .from(tacticsScenes)
      .where(eq(tacticsScenes.id, sceneId));
    if (!scene) return null;
    if (tagIds.length === 0) return 0;

    const linked = await tx
      .select({
        id: tags.id,
        gameId: tags.gameId,
        type: tags.type,
        startS: tags.startS,
        endS: tags.endS,
      })
      .from(tags)
      .where(inArray(tags.id, [...tagIds]));
    if (linked.length === 0) return 0;

    const goals = await tx
      .select({
        gameId: tags.gameId,
        type: tags.type,
        startS: tags.startS,
        endS: tags.endS,
      })
      .from(tags)
      .where(
        and(
          tagHasType(GOAL_TYPE),
          inArray(tags.gameId, [...new Set(linked.map((tag) => tag.gameId))]),
        ),
      );
    const window = (tag: {
      startS: number;
      endS: number | null;
      type: string;
    }) => ({
      startS: tag.startS,
      endS: resolveClipEnd(tag.startS, tag.endS, tag.type, windows),
    });

    const inserted = await tx
      .insert(sceneExecutions)
      .values(
        linked.map((tag) => ({
          sceneId,
          tagId: tag.id,
          outcome: defaultOutcome(
            window(tag),
            goals.filter((goal) => goal.gameId === tag.gameId).map(window),
          ),
        })),
      )
      .onConflictDoNothing()
      .returning({ tagId: sceneExecutions.tagId });
    return inserted.length;
  });
}

/** Rate one execution; `false` when the tag is not linked to the scene. */
export async function setExecutionOutcome(
  sceneId: string,
  tagId: string,
  outcome: ExecutionOutcome,
): Promise<boolean> {
  const rows = await db
    .update(sceneExecutions)
    .set({ outcome })
    .where(
      and(
        eq(sceneExecutions.sceneId, sceneId),
        eq(sceneExecutions.tagId, tagId),
      ),
    )
    .returning({ tagId: sceneExecutions.tagId });
  return rows.length > 0;
}

/** Remove one execution; `false` when the tag was not linked to the scene. */
export async function unlinkExecution(
  sceneId: string,
  tagId: string,
): Promise<boolean> {
  const rows = await db
    .delete(sceneExecutions)
    .where(
      and(
        eq(sceneExecutions.sceneId, sceneId),
        eq(sceneExecutions.tagId, tagId),
      ),
    )
    .returning({ tagId: sceneExecutions.tagId });
  return rows.length > 0;
}

/**
 * Every scene a tag can be linked to, by name, with how its link stands, or
 * `null` when the tag does not exist. Only names and outcomes: no scene
 * document leaves the server here.
 */
export async function listTagSceneChoices(
  tagId: string,
): Promise<TagSceneChoice[] | null> {
  const [tag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.id, tagId));
  if (!tag) return null;
  const [scenes, links] = await Promise.all([
    db
      .select({ id: tacticsScenes.id, name: tacticsScenes.name })
      .from(tacticsScenes)
      .orderBy(asc(tacticsScenes.name), asc(tacticsScenes.id)),
    db
      .select({
        sceneId: sceneExecutions.sceneId,
        outcome: sceneExecutions.outcome,
      })
      .from(sceneExecutions)
      .where(eq(sceneExecutions.tagId, tagId)),
  ]);
  const outcomes = new Map(links.map((link) => [link.sceneId, link.outcome]));
  return scenes.map((scene) => ({
    ...scene,
    outcome: outcomes.get(scene.id) ?? null,
  }));
}
