/**
 * The database side of the clip files the Mac uploads (Mac plan S5): take the
 * next upload handed off to the worker, then report the outcome onto the
 * upload and its clip; and sweep what no one will finish.
 *
 * A `mac` game's clip is `processing` exactly while one of its uploads is
 * `submitted`. The hand-off route sets both at once; this queue ends both at
 * once, in one transaction that locks the upload and the clip, so a tag edit
 * that put the clip back to `pending` in the meantime - or a newer hand-off
 * that superseded the upload - drops the file instead of serving a stale cut.
 *
 * The runner sees this module through {@link UploadQueue} and is unit-tested
 * against a fake.
 */
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";

import type { WorkerDatabase } from "./queue";

import type { ClipSource } from "@/features/clips/boundary";
import { readTagWindows } from "@/features/tag-windows/read";
import { clips, gameSources, tags, uploads } from "@/lib/db/schema";
import type { TagWindows } from "@/lib/tag-types";

/** One handed-off clip file to check and move into place. */
export interface UploadJob {
  readonly uploadId: string;
  readonly clipId: string;
  readonly sizeBytes: number;
  /** The game time at clip-file time 0 the Mac recorded. */
  readonly cutStartS: number;
  readonly tagType: string;
  readonly startS: number;
  readonly endS: number | null;
  /** The team's tag windows, which a tag without an end is cut by. */
  readonly windows: TagWindows;
  readonly sources: readonly ClipSource[];
}

/** What sweeping found and did. */
export interface UploadSweep {
  /** Uploads still receiving or handed off: their staged files stay. */
  readonly liveIds: ReadonlySet<string>;
  /** Uploads removed because they expired or finished long ago. */
  readonly removed: number;
  /** `mac` clips put back to `pending` because no upload was left for them. */
  readonly requeued: number;
}

/** What the upload runner needs from the database, so it can be faked. */
export interface UploadQueue {
  /** The oldest `submitted` upload, or null when none waits. */
  nextSubmitted(): Promise<UploadJob | null>;
  /**
   * Serve the checked file: the clip goes `ready` at `outputPath` with the
   * upload's file start, the upload `done`. Resolves the clip's previous file
   * (null when it had none), or `false`, changing only the upload to
   * `failed`, when the clip no longer waits for this upload.
   */
  finish(job: UploadJob, outputPath: string): Promise<string | null | false>;
  /**
   * Refuse the file: the upload goes `failed`, and so does its clip if it was
   * still waiting for this upload. Resolves the failed clip's previous file,
   * null when it had none, or `false` when the clip was left alone.
   */
  refuse(job: UploadJob): Promise<string | null | false>;
  /**
   * Remove `receiving` uploads past their expiry and finished ones older than
   * `retainMs`, and put `mac` clips left `processing` without a `submitted`
   * upload back to `pending`.
   */
  sweep(now: Date, retainMs: number): Promise<UploadSweep>;
}

/** The queue backed by the real database. */
export function createUploadQueue(db: WorkerDatabase): UploadQueue {
  return {
    async nextSubmitted(): Promise<UploadJob | null> {
      const [row] = await db
        .select({
          uploadId: uploads.id,
          clipId: clips.id,
          sizeBytes: uploads.sizeBytes,
          cutStartS: uploads.cutStartS,
          tagType: tags.type,
          startS: tags.startS,
          endS: tags.endS,
          gameId: tags.gameId,
        })
        .from(uploads)
        .innerJoin(clips, eq(clips.id, uploads.clipId))
        .innerJoin(tags, eq(tags.id, clips.tagId))
        .where(eq(uploads.status, "submitted"))
        .orderBy(asc(uploads.updatedAt))
        .limit(1);
      if (!row) return null;

      const [sources, windows] = await Promise.all([
        db
          .select({
            orderIndex: gameSources.orderIndex,
            filePath: gameSources.filePath,
            durationS: gameSources.durationS,
          })
          .from(gameSources)
          .where(eq(gameSources.gameId, row.gameId))
          .orderBy(asc(gameSources.orderIndex)),
        readTagWindows(db),
      ]);
      return {
        uploadId: row.uploadId,
        clipId: row.clipId,
        sizeBytes: row.sizeBytes,
        // The hand-off sets it with the status; a row without one is refused
        // by the runner's duration check rather than served with a guess.
        cutStartS: row.cutStartS ?? Number.NaN,
        tagType: row.tagType,
        startS: row.startS,
        endS: row.endS,
        windows,
        sources,
      };
    },

    finish(job, outputPath) {
      return db.transaction(async (tx) => {
        const claim = await lockClaim(tx, job);
        if (!claim.waiting) {
          await tx
            .update(uploads)
            .set({ status: "failed" })
            .where(eq(uploads.id, job.uploadId));
          return false;
        }
        await tx
          .update(clips)
          .set({ status: "ready", outputPath, cutStartS: job.cutStartS })
          .where(eq(clips.id, job.clipId));
        await tx
          .update(uploads)
          .set({ status: "done" })
          .where(eq(uploads.id, job.uploadId));
        return claim.previousOutputPath;
      });
    },

    refuse(job) {
      return db.transaction(async (tx) => {
        const claim = await lockClaim(tx, job);
        await tx
          .update(uploads)
          .set({ status: "failed" })
          .where(eq(uploads.id, job.uploadId));
        if (!claim.waiting) return false;
        await tx
          .update(clips)
          .set({ status: "failed", outputPath: null, cutStartS: null })
          .where(eq(clips.id, job.clipId));
        return claim.previousOutputPath;
      });
    },

    async sweep(now, retainMs) {
      const expired = await db
        .delete(uploads)
        .where(and(eq(uploads.status, "receiving"), lt(uploads.expiresAt, now)))
        .returning({ id: uploads.id });
      const finished = await db
        .delete(uploads)
        .where(
          and(
            inArray(uploads.status, ["done", "failed"]),
            lt(uploads.updatedAt, new Date(now.getTime() - retainMs)),
          ),
        )
        .returning({ id: uploads.id });
      const requeued = await db
        .update(clips)
        .set({ status: "pending" })
        .where(
          and(
            eq(clips.status, "processing"),
            sql`exists (
              select 1 from ${tags}
              join games on games.id = ${tags.gameId}
              where ${tags.id} = ${clips.tagId} and games.media_home = 'mac'
            )`,
            sql`not exists (
              select 1 from ${uploads}
              where ${uploads.clipId} = ${clips.id}
                and ${uploads.status} = 'submitted'
            )`,
          ),
        )
        .returning({ id: clips.id });
      const live = await db
        .select({ id: uploads.id })
        .from(uploads)
        .where(inArray(uploads.status, ["receiving", "submitted"]));
      return {
        liveIds: new Set(live.map((row) => row.id)),
        removed: expired.length + finished.length,
        requeued: requeued.length,
      };
    },
  };
}

type Transaction = Parameters<Parameters<WorkerDatabase["transaction"]>[0]>[0];

/**
 * Lock the clip and the upload - in the hand-off route's order, so the two
 * never wait on each other - and tell whether the clip still waits for this
 * upload: the upload is `submitted` and the clip `processing`.
 */
async function lockClaim(
  tx: Transaction,
  job: UploadJob,
): Promise<{ waiting: boolean; previousOutputPath: string | null }> {
  const [clip] = await tx
    .select({ status: clips.status, outputPath: clips.outputPath })
    .from(clips)
    .where(eq(clips.id, job.clipId))
    .for("update");
  const [upload] = await tx
    .select({ status: uploads.status })
    .from(uploads)
    .where(eq(uploads.id, job.uploadId))
    .for("update");
  return {
    waiting: upload?.status === "submitted" && clip?.status === "processing",
    previousOutputPath: clip?.outputPath ?? null,
  };
}
