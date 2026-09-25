/**
 * Reading a collection's viewing figures (ADR 0009) for the coach. The database
 * groups the raw events per day - the only span a viewer key is meaningful in -
 * and {@link summarizeViewStats} sums the days. Events past retention are left
 * out even if pruning has not deleted them yet.
 */
import "server-only";
import { and, countDistinct, eq, gte, sql } from "drizzle-orm";

import type { ViewEventType } from "./events";
import { retentionCutoff } from "./record";
import { type CollectionViewStats, summarizeViewStats } from "./stats";

import { db } from "@/lib/db";
import { collectionViewEvents } from "@/lib/db/schema";

/** `count(*)` of the grouped events of one type. */
function countOfType(type: ViewEventType) {
  return sql<number>`count(*) filter (where ${collectionViewEvents.type} = ${type})`.mapWith(
    Number,
  );
}

/**
 * Clicks, full views, replays and unique viewers for one collection, in total
 * and per clip. A collection nobody has viewed yet returns all zeros.
 */
export async function getCollectionViewStats(
  collectionId: string,
  now: Date = new Date(),
): Promise<CollectionViewStats> {
  const inWindow = and(
    eq(collectionViewEvents.collectionId, collectionId),
    gte(collectionViewEvents.day, retentionCutoff(now)),
  );

  const [clipDays, collectionDays] = await Promise.all([
    db
      .select({
        clipId: collectionViewEvents.clipId,
        clicks: countOfType("click"),
        fullViews: countOfType("full_view"),
        replays: countOfType("replay"),
        viewers: countDistinct(collectionViewEvents.viewerKey),
      })
      .from(collectionViewEvents)
      .where(inWindow)
      .groupBy(collectionViewEvents.clipId, collectionViewEvents.day),
    db
      .select({ viewers: countDistinct(collectionViewEvents.viewerKey) })
      .from(collectionViewEvents)
      .where(inWindow)
      .groupBy(collectionViewEvents.day),
  ]);

  return summarizeViewStats(clipDays, collectionDays);
}
