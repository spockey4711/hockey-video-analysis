/**
 * Recording one view event from a collection share link (ADR 0009). The report
 * is only accepted for a ready clip that is in the collection its share token
 * names, so a token can never count views on clips outside its own set. The day
 * and the viewer key are derived here, never taken from the client, and only
 * the key is stored - not the IP address or user agent it was hashed from.
 *
 * Two cheap bounds keep a noisy or hostile client from flooding the table: an
 * event identical to one the same viewer sent moments ago is dropped (double
 * fires, hammering), and one viewer can add at most {@link DAILY_EVENT_LIMIT}
 * events to a collection per day. Events older than {@link RETENTION_DAYS} are
 * deleted as new ones arrive.
 */
import "server-only";
import { and, count, eq, lt, max } from "drizzle-orm";

import type { ViewEventInput } from "./events";
import { dailySaltStore, utcDay, viewerKey } from "./viewer-key";

import { db } from "@/lib/db";
import {
  clips,
  collectionClips,
  collectionViewEvents,
  collections,
} from "@/lib/db/schema";

/** An identical event from the same viewer within this window is a duplicate. */
export const DEDUPE_WINDOW_MS = 5_000;

/** Most events one viewer can add to one collection in one day. */
export const DAILY_EVENT_LIMIT = 1_000;

/** How long raw events are kept, in days. */
export const RETENTION_DAYS = 365;

/** How often a server process deletes expired events, at most. */
const PRUNE_INTERVAL_MS = 60 * 60 * 1_000;

const DAY_MS = 24 * 60 * 60 * 1_000;

/** The viewer's request details, used only to derive the viewer key. */
export interface ViewerRequest {
  readonly ip: string;
  readonly userAgent: string;
}

/** What happened to a report: stored, dropped by a bound, or not for this link. */
export type RecordOutcome = "recorded" | "duplicate" | "limited" | "not-found";

/** What the bounds look at: this viewer's events on the collection today. */
export interface ViewerHistory {
  readonly eventsToday: number;
  /** When this viewer last sent the same event for the same clip today. */
  readonly lastIdenticalAt: Date | null;
}

/** Whether a new event passes the abuse bounds, given the viewer's history. */
export function admitEvent(
  history: ViewerHistory,
  now: Date,
): "ok" | "duplicate" | "limited" {
  if (
    history.lastIdenticalAt !== null &&
    now.getTime() - history.lastIdenticalAt.getTime() < DEDUPE_WINDOW_MS
  ) {
    return "duplicate";
  }
  if (history.eventsToday >= DAILY_EVENT_LIMIT) return "limited";
  return "ok";
}

/** The first day still kept: events on earlier days are past retention. */
export function retentionCutoff(now: Date): string {
  return utcDay(new Date(now.getTime() - RETENTION_DAYS * DAY_MS));
}

/**
 * Resolve a share token and clip to the collection they belong to, or
 * `undefined` when the token names no collection or the clip is not a ready
 * clip in it.
 */
async function findCollectionForClip(
  token: string,
  clipId: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ collectionId: collections.id })
    .from(collections)
    .innerJoin(
      collectionClips,
      eq(collectionClips.collectionId, collections.id),
    )
    .innerJoin(clips, eq(collectionClips.clipId, clips.id))
    .where(
      and(
        eq(collections.shareToken, token),
        eq(collectionClips.clipId, clipId),
        eq(clips.status, "ready"),
      ),
    )
    .limit(1);
  return row?.collectionId;
}

async function readViewerHistory(
  collectionId: string,
  key: string,
  day: string,
  event: ViewEventInput,
): Promise<ViewerHistory> {
  const sameViewerToday = and(
    eq(collectionViewEvents.collectionId, collectionId),
    eq(collectionViewEvents.viewerKey, key),
    eq(collectionViewEvents.day, day),
  );
  const [[identical], [today]] = await Promise.all([
    db
      .select({ at: max(collectionViewEvents.createdAt) })
      .from(collectionViewEvents)
      .where(
        and(
          sameViewerToday,
          eq(collectionViewEvents.clipId, event.clipId),
          eq(collectionViewEvents.type, event.type),
        ),
      ),
    db
      .select({ events: count() })
      .from(collectionViewEvents)
      .where(sameViewerToday),
  ]);
  return {
    eventsToday: today?.events ?? 0,
    lastIdenticalAt: identical?.at ?? null,
  };
}

// When this process last deleted expired events; see PRUNE_INTERVAL_MS.
let lastPrunedAt = 0;

/** Delete events past retention, at most once per interval per process. */
async function pruneExpiredEvents(now: Date): Promise<void> {
  if (now.getTime() - lastPrunedAt < PRUNE_INTERVAL_MS) return;
  lastPrunedAt = now.getTime();
  try {
    await db
      .delete(collectionViewEvents)
      .where(lt(collectionViewEvents.day, retentionCutoff(now)));
  } catch (cause) {
    // Pruning is housekeeping: a failure must not fail the viewer's report.
    console.error("failed to prune expired view events", cause);
  }
}

/** Record one validated event from a collection link, subject to the bounds. */
export async function recordViewEvent(
  event: ViewEventInput,
  viewer: ViewerRequest,
  now: Date = new Date(),
): Promise<RecordOutcome> {
  const collectionId = await findCollectionForClip(event.token, event.clipId);
  if (!collectionId) return "not-found";

  const day = utcDay(now);
  const key = viewerKey(dailySaltStore().saltFor(day), {
    ip: viewer.ip,
    userAgent: viewer.userAgent,
    collectionId,
  });

  const admitted = admitEvent(
    await readViewerHistory(collectionId, key, day, event),
    now,
  );
  if (admitted !== "ok") return admitted;

  await db.insert(collectionViewEvents).values({
    collectionId,
    clipId: event.clipId,
    type: event.type,
    day,
    viewerKey: key,
    createdAt: now,
  });
  await pruneExpiredEvents(now);
  return "recorded";
}
