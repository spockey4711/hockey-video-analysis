/**
 * The web app's side of the Mac app's uploads (ADR 0013, Mac plan S5): an
 * upload's row, the offset its chunks advance, and handing a finished clip
 * file to the clip worker. Every read and write is scoped to the coach whose
 * device made the upload, so an upload id alone reaches nothing; the staged
 * bytes themselves are `./staging`'s.
 *
 * Only a `mac` game's clips take uploads: the VPS cuts every other game's
 * clips itself, and a file from the Mac must never replace one of those.
 */
import "server-only";

import { and, eq, ne } from "drizzle-orm";

import { uploadExpiresAt } from "./limits";
import type { ClipFileHandoff, UploadCreation } from "./validation";

import { db } from "@/lib/db";
import { clips, games, tags, uploads } from "@/lib/db/schema";

/** An upload as the Mac sees it. */
export interface UploadState {
  readonly id: string;
  readonly sizeBytes: number;
  readonly receivedBytes: number;
  readonly status: (typeof uploads.$inferSelect)["status"];
  readonly expiresAt: Date;
}

const uploadColumns = {
  id: uploads.id,
  sizeBytes: uploads.sizeBytes,
  receivedBytes: uploads.receivedBytes,
  status: uploads.status,
  expiresAt: uploads.expiresAt,
};

/** What announcing an upload did. */
export type CreateUploadOutcome =
  | { readonly kind: "created"; readonly upload: UploadState }
  /** No such clip. */
  | { readonly kind: "not_found" }
  /** The clip belongs to a game the VPS cuts. */
  | { readonly kind: "not_mac" };

/** Record a new upload for a clip of a `mac` game. */
export async function createClipUpload(
  creation: UploadCreation,
  coachId: string,
  now: Date = new Date(),
): Promise<CreateUploadOutcome> {
  const [clip] = await db
    .select({ mediaHome: games.mediaHome })
    .from(clips)
    .innerJoin(tags, eq(tags.id, clips.tagId))
    .innerJoin(games, eq(games.id, tags.gameId))
    .where(eq(clips.id, creation.clipId));
  if (!clip) return { kind: "not_found" };
  if (clip.mediaHome !== "mac") return { kind: "not_mac" };

  const [upload] = await db
    .insert(uploads)
    .values({
      coachId,
      purpose: creation.purpose,
      clipId: creation.clipId,
      sizeBytes: creation.sizeBytes,
      expiresAt: uploadExpiresAt(now),
    })
    .returning(uploadColumns);
  return { kind: "created", upload };
}

/** The coach's upload with this id, or null. */
export async function readUpload(
  uploadId: string,
  coachId: string,
): Promise<UploadState | null> {
  const [upload] = await db
    .select(uploadColumns)
    .from(uploads)
    .where(and(eq(uploads.id, uploadId), eq(uploads.coachId, coachId)));
  return upload ?? null;
}

/**
 * Move a receiving upload's offset from `from` to `to` and its expiry
 * forward. Resolves null, changing nothing, when the upload no longer stands
 * at `from` (a parallel chunk got there first) or stopped receiving.
 */
export async function advanceUpload(
  uploadId: string,
  coachId: string,
  from: number,
  to: number,
  now: Date = new Date(),
): Promise<UploadState | null> {
  const [upload] = await db
    .update(uploads)
    .set({ receivedBytes: to, expiresAt: uploadExpiresAt(now) })
    .where(
      and(
        eq(uploads.id, uploadId),
        eq(uploads.coachId, coachId),
        eq(uploads.status, "receiving"),
        eq(uploads.receivedBytes, from),
      ),
    )
    .returning(uploadColumns);
  return upload ?? null;
}

/**
 * Drop the coach's upload unless the clip worker has it: `deleted`, `gone`
 * when the coach has no such upload, or `submitted` when it was handed off
 * and stays. Only a `deleted` upload's staged file may be removed.
 */
export async function deleteUpload(
  uploadId: string,
  coachId: string,
): Promise<"deleted" | "gone" | "submitted"> {
  const removed = await db
    .delete(uploads)
    .where(
      and(
        eq(uploads.id, uploadId),
        eq(uploads.coachId, coachId),
        ne(uploads.status, "submitted"),
      ),
    )
    .returning({ id: uploads.id });
  if (removed.length > 0) return "deleted";
  return (await readUpload(uploadId, coachId)) ? "submitted" : "gone";
}

/**
 * How far before its tag a clip file may start: the Mac starts a cut on the
 * keyframe at or before the tag, and no camera spaces keyframes further apart.
 */
export const MAX_CUT_LEAD_S = 10;

// Timestamps round differently on the Mac and here; a file may start this much
// after the tag's start and still count as starting on it.
const CUT_START_SLACK_S = 0.05;

/** A tag's window and version, as a refused hand-off reports it. */
export interface HandoffTag {
  readonly id: string;
  readonly version: number;
  readonly type: string;
  readonly startS: number;
  readonly endS: number | null;
}

/** What handing a clip file to the clip worker did. */
export type HandoffOutcome =
  /** The worker has the file; `clipStatus` is the clip's status now. */
  | { readonly kind: "accepted"; readonly clipStatus: ClipStatus }
  /** No such clip. */
  | { readonly kind: "not_found" }
  /** The clip belongs to a game the VPS cuts. */
  | { readonly kind: "not_mac" }
  /** The coach has no upload with this id. */
  | { readonly kind: "upload_not_found" }
  /** The upload was announced for another clip or purpose. */
  | { readonly kind: "wrong_target" }
  /** The upload was handed off already, or refused. */
  | { readonly kind: "upload_used"; readonly status: UploadState["status"] }
  /** Bytes are still missing. */
  | { readonly kind: "incomplete"; readonly receivedBytes: number }
  /** The tag moved past the version the Mac cut from. */
  | { readonly kind: "tag_moved"; readonly tag: HandoffTag }
  /** The clip is not waiting for a file (it is being checked, or done). */
  | { readonly kind: "clip_busy"; readonly clipStatus: ClipStatus }
  /** The stated file start does not fit the tag's start. */
  | { readonly kind: "bad_cut_start" };

type ClipStatus = (typeof clips.$inferSelect)["status"];

/**
 * Hand the coach's finished upload to the clip worker as the file of a
 * `pending` clip of a `mac` game, cut from tag version `tagVersion`.
 *
 * The clip and its tag are locked for the check, so a tag edit either lands
 * before it (and the hand-off is refused as `tag_moved`) or after it (and puts
 * the clip back to `pending`, so the worker drops this file). The clip goes
 * `processing` until the worker has checked the file; an older hand-off still
 * waiting for the worker is superseded, since the clip was re-queued after it.
 * A retry of an accepted hand-off is accepted again and changes nothing.
 */
export async function handOffClipFile(
  clipId: string,
  handoff: ClipFileHandoff,
  coachId: string,
): Promise<HandoffOutcome> {
  return db.transaction(async (tx) => {
    const [clip] = await tx
      .select({
        status: clips.status,
        mediaHome: games.mediaHome,
        tag: {
          id: tags.id,
          version: tags.version,
          type: tags.type,
          startS: tags.startS,
          endS: tags.endS,
        },
      })
      .from(clips)
      .innerJoin(tags, eq(tags.id, clips.tagId))
      .innerJoin(games, eq(games.id, tags.gameId))
      .where(eq(clips.id, clipId))
      .for("update", { of: [clips, tags] });
    if (!clip) return { kind: "not_found" };
    if (clip.mediaHome !== "mac") return { kind: "not_mac" };

    const [upload] = await tx
      .select({
        purpose: uploads.purpose,
        clipId: uploads.clipId,
        sizeBytes: uploads.sizeBytes,
        receivedBytes: uploads.receivedBytes,
        status: uploads.status,
        tagVersion: uploads.tagVersion,
      })
      .from(uploads)
      .where(
        and(eq(uploads.id, handoff.uploadId), eq(uploads.coachId, coachId)),
      )
      .for("update");
    if (!upload) return { kind: "upload_not_found" };
    if (upload.purpose !== "clip" || upload.clipId !== clipId) {
      return { kind: "wrong_target" };
    }
    if (upload.status !== "receiving") {
      const retry =
        upload.status !== "failed" && upload.tagVersion === handoff.tagVersion;
      return retry
        ? { kind: "accepted", clipStatus: clip.status }
        : { kind: "upload_used", status: upload.status };
    }
    if (upload.receivedBytes < upload.sizeBytes) {
      return { kind: "incomplete", receivedBytes: upload.receivedBytes };
    }
    if (clip.tag.version !== handoff.tagVersion) {
      return { kind: "tag_moved", tag: clip.tag };
    }
    if (clip.status !== "pending") {
      return { kind: "clip_busy", clipStatus: clip.status };
    }
    if (
      handoff.cutStartS > clip.tag.startS + CUT_START_SLACK_S ||
      handoff.cutStartS < clip.tag.startS - MAX_CUT_LEAD_S
    ) {
      return { kind: "bad_cut_start" };
    }

    await tx
      .update(uploads)
      .set({ status: "failed" })
      .where(
        and(
          eq(uploads.clipId, clipId),
          eq(uploads.status, "submitted"),
          ne(uploads.id, handoff.uploadId),
        ),
      );
    await tx
      .update(clips)
      .set({ status: "processing" })
      .where(eq(clips.id, clipId));
    await tx
      .update(uploads)
      .set({
        status: "submitted",
        tagVersion: handoff.tagVersion,
        cutStartS: handoff.cutStartS,
      })
      .where(eq(uploads.id, handoff.uploadId));
    return { kind: "accepted", clipStatus: "processing" };
  });
}
