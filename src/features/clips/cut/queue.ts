/**
 * The database side of the clip cut queue: claim a `pending` clip, then report
 * the outcome back onto the same row; and, when the queue is idle, find ready
 * clips whose file start was never probed (ADR 0011).
 *
 * `clips` is the queue (ADR 0003): the app inserts a `pending` row when a coach
 * asks for a clip, the worker moves it `processing -> ready | failed`. Claiming
 * is a single `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)`, so
 * two workers - or a worker and a restarting one - never take the same job and
 * never block on each other.
 *
 * This module is the only part of the worker that talks to Postgres; the runner
 * sees it through {@link ClipQueue} and is unit-tested against a fake.
 */
import { and, asc, eq, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { ClipSource } from "@/features/clips/boundary";
import { readTagWindows } from "@/features/tag-windows/read";
import * as schema from "@/lib/db/schema";
import { clips, gameSources, tags } from "@/lib/db/schema";
import type { TagWindows } from "@/lib/tag-types";

/** A drizzle client over this app's schema, created by the worker entrypoint. */
export type WorkerDatabase = PostgresJsDatabase<typeof schema>;

/** One claimed cut job: the clip, the window it came from, and its chapters. */
export interface ClipJob {
  readonly clipId: string;
  readonly tagId: string;
  readonly tagType: string;
  readonly startS: number;
  /** Null when the tag carries no explicit end; see `resolveClipEnd`. */
  readonly endS: number | null;
  /** The team's tag windows, which a tag without an end is cut by. */
  readonly windows: TagWindows;
  readonly sources: readonly ClipSource[];
  /**
   * The file an earlier cut of this clip left behind, or null on a first cut. A
   * clip is cut again when its tag's window is edited (it goes back to
   * `pending` but keeps its id, so collections and comments stay attached), and
   * the runner removes this file once the row no longer points at it.
   */
  readonly previousOutputPath: string | null;
}

/**
 * A `ready` clip whose file start was never probed (ADR 0011): cut before the
 * worker recorded `cut_start_s`, or a probe failed at cut time. Its file was cut
 * from its tag's current window, because a window edit sends a clip back to
 * `pending`, so the window below is the one the file holds.
 */
export interface UnprobedClip {
  readonly clipId: string;
  readonly tagType: string;
  readonly startS: number;
  readonly endS: number | null;
  /** The team's tag windows, which a tag without an end is cut by. */
  readonly windows: TagWindows;
  readonly sources: readonly ClipSource[];
  /** The served file, relative to the media root. */
  readonly outputPath: string;
}

/** What the runner needs from the queue, so it can be faked in tests. */
export interface ClipQueue {
  /** Claim the oldest `pending` clip, or null when the queue is empty. */
  claimNext(): Promise<ClipJob | null>;
  /**
   * Record a finished cut: `ready`, the path the app serves it from, and the
   * game time at file time 0 (null when the probe failed; the backfill retries).
   * Resolves false, changing nothing, when the clip is no longer `processing` -
   * its tag was edited mid-cut and the row went back to `pending`, so this cut
   * shows a stale window and the next claim cuts the new one.
   */
  markReady(
    clipId: string,
    outputPath: string,
    cutStartS: number | null,
  ): Promise<boolean>;
  /**
   * Record a failed cut: `failed`, which the coach may re-enqueue. Resolves
   * false, changing nothing, when the clip was re-queued mid-cut (see
   * `markReady`).
   */
  markFailed(clipId: string): Promise<boolean>;
  /**
   * The oldest {@link UnprobedClip}, leaving out `skipIds` (clips whose probe
   * already failed in this run), or null when every ready clip is probed.
   */
  nextUnprobed(skipIds: readonly string[]): Promise<UnprobedClip | null>;
  /**
   * Record a backfilled file start. Resolves false, changing nothing, unless the
   * clip is still `ready` from the same file with no start recorded - it was
   * re-cut or deleted while being probed.
   */
  recordCutStart(
    clipId: string,
    outputPath: string,
    cutStartS: number,
  ): Promise<boolean>;
}

/** The row the claim statement returns before its tag and chapters are loaded. */
interface ClaimedRow {
  readonly clip_id: string;
  readonly tag_id: string;
  readonly tag_type: string;
  readonly start_s: number;
  readonly end_s: number | null;
  readonly game_id: string;
  readonly previous_output_path: string | null;
}

// Claim and read the tag in one statement: claiming first and reading after
// would leave a window in which the tag is edited or deleted between the two.
// `SKIP LOCKED` lets a second worker take the next row instead of waiting.
const CLAIM_SQL = sql`
  UPDATE clips
  SET status = 'processing', updated_at = now()
  FROM tags
  WHERE tags.id = clips.tag_id
    AND clips.id = (
      SELECT id FROM clips
      WHERE status = 'pending'
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
  RETURNING
    clips.id AS clip_id,
    clips.tag_id AS tag_id,
    tags.type AS tag_type,
    tags.start_s AS start_s,
    tags.end_s AS end_s,
    tags.game_id AS game_id,
    clips.output_path AS previous_output_path
`;

// Only the cut that claimed the row may finish it. Re-queuing on a tag edit
// moves a `processing` row back to `pending`, so this guard drops the stale
// result. It is sufficient because a single worker runs per deployment (see
// `requeueStaleProcessing`); several workers would need a claim token instead.
const isProcessing = eq(clips.status, "processing");

/** The queue backed by the real database. */
export function createClipQueue(db: WorkerDatabase): ClipQueue {
  const sourcesOf = (gameId: string): Promise<ClipSource[]> =>
    db
      .select({
        orderIndex: gameSources.orderIndex,
        filePath: gameSources.filePath,
        durationS: gameSources.durationS,
      })
      .from(gameSources)
      .where(eq(gameSources.gameId, gameId))
      .orderBy(asc(gameSources.orderIndex));

  return {
    async claimNext(): Promise<ClipJob | null> {
      const claimed = (await db.execute(CLAIM_SQL)) as unknown as ClaimedRow[];
      const row = claimed[0];
      if (!row) return null;

      const [sources, windows] = await Promise.all([
        sourcesOf(row.game_id),
        readTagWindows(db),
      ]);

      return {
        clipId: row.clip_id,
        tagId: row.tag_id,
        tagType: row.tag_type,
        startS: Number(row.start_s),
        endS: row.end_s === null ? null : Number(row.end_s),
        windows,
        sources,
        previousOutputPath: row.previous_output_path,
      };
    },

    async markReady(
      clipId: string,
      outputPath: string,
      cutStartS: number | null,
    ): Promise<boolean> {
      const updated = await db
        .update(clips)
        .set({ status: "ready", outputPath, cutStartS })
        .where(and(eq(clips.id, clipId), isProcessing))
        .returning({ id: clips.id });
      return updated.length > 0;
    },

    async markFailed(clipId: string): Promise<boolean> {
      const updated = await db
        .update(clips)
        .set({ status: "failed", outputPath: null, cutStartS: null })
        .where(and(eq(clips.id, clipId), isProcessing))
        .returning({ id: clips.id });
      return updated.length > 0;
    },

    async nextUnprobed(
      skipIds: readonly string[],
    ): Promise<UnprobedClip | null> {
      const [row] = await db
        .select({
          clipId: clips.id,
          outputPath: clips.outputPath,
          tagType: tags.type,
          startS: tags.startS,
          endS: tags.endS,
          gameId: tags.gameId,
        })
        .from(clips)
        .innerJoin(tags, eq(tags.id, clips.tagId))
        .where(
          and(
            eq(clips.status, "ready"),
            isNull(clips.cutStartS),
            isNotNull(clips.outputPath),
            skipIds.length > 0 ? notInArray(clips.id, [...skipIds]) : undefined,
          ),
        )
        .orderBy(asc(clips.createdAt))
        .limit(1);
      if (!row || row.outputPath === null) return null;

      return {
        clipId: row.clipId,
        tagType: row.tagType,
        startS: row.startS,
        endS: row.endS,
        windows: await readTagWindows(db),
        sources: await sourcesOf(row.gameId),
        outputPath: row.outputPath,
      };
    },

    async recordCutStart(
      clipId: string,
      outputPath: string,
      cutStartS: number,
    ): Promise<boolean> {
      const updated = await db
        .update(clips)
        .set({ cutStartS })
        .where(
          and(
            eq(clips.id, clipId),
            eq(clips.status, "ready"),
            eq(clips.outputPath, outputPath),
            isNull(clips.cutStartS),
          ),
        )
        .returning({ id: clips.id });
      return updated.length > 0;
    },
  };
}

/**
 * Release clips this worker left `processing` when it stopped.
 *
 * A crash or a container restart mid-cut leaves a row `processing` with nobody
 * working on it, and nothing would ever pick it up again. Running this once at
 * startup puts those orphans back on the queue. It is safe only because a single
 * worker runs per deployment (see the compose service); with several workers
 * this would steal a live job and needs a heartbeat column instead.
 */
export async function requeueStaleProcessing(
  db: WorkerDatabase,
): Promise<number> {
  const requeued = await db
    .update(clips)
    .set({ status: "pending" })
    .where(eq(clips.status, "processing"))
    .returning({ id: clips.id });
  return requeued.length;
}
