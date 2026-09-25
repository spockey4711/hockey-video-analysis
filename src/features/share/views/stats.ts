/**
 * Folding a collection's per-day event counts into the figures a coach reads
 * (ADR 0009): clicks, full views, replays and unique viewers, per clip and for
 * the whole collection. Pure, so the counting rules are unit-tested without a
 * database; {@link getCollectionViewStats} feeds it.
 *
 * Unique viewers are only known within a day, because the viewer key's salt is
 * replaced every day. A multi-day total is therefore the sum of each day's
 * unique viewers: someone who watches on three days counts three times. That is
 * the documented approximation, and the price of keys that cannot be traced
 * back after their day.
 */

/** The figures for one clip or for the whole collection. */
export interface ViewCounts {
  readonly clicks: number;
  readonly fullViews: number;
  readonly replays: number;
  /** Sum over days of that day's distinct viewers. */
  readonly uniqueViewers: number;
}

/** One clip's counts on one day, as the database groups them. */
export interface ClipDayCounts {
  readonly clipId: string;
  readonly clicks: number;
  readonly fullViews: number;
  readonly replays: number;
  /** Distinct viewer keys that sent any event for this clip that day. */
  readonly viewers: number;
}

/** The collection's distinct viewers on one day, across all of its clips. */
export interface CollectionDayViewers {
  readonly viewers: number;
}

/** A collection's viewing figures: the totals and each clip's share. */
export interface CollectionViewStats {
  readonly collection: ViewCounts;
  /** Keyed by clip id; a clip nobody has opened has no entry. */
  readonly clips: Readonly<Record<string, ViewCounts>>;
}

export const EMPTY_VIEW_COUNTS: ViewCounts = {
  clicks: 0,
  fullViews: 0,
  replays: 0,
  uniqueViewers: 0,
};

function add(total: ViewCounts, day: ClipDayCounts): ViewCounts {
  return {
    clicks: total.clicks + day.clicks,
    fullViews: total.fullViews + day.fullViews,
    replays: total.replays + day.replays,
    uniqueViewers: total.uniqueViewers + day.viewers,
  };
}

/**
 * Sum per-day rows into per-clip and collection figures. The collection's
 * unique viewers come from `collectionDays`, not from the clips: one viewer who
 * opens five clips on a day is one collection viewer but a viewer of each clip.
 */
export function summarizeViewStats(
  clipDays: readonly ClipDayCounts[],
  collectionDays: readonly CollectionDayViewers[],
): CollectionViewStats {
  const clips: Record<string, ViewCounts> = {};
  let collection = EMPTY_VIEW_COUNTS;
  for (const day of clipDays) {
    clips[day.clipId] = add(clips[day.clipId] ?? EMPTY_VIEW_COUNTS, day);
    collection = add(collection, { ...day, viewers: 0 });
  }
  const uniqueViewers = collectionDays.reduce(
    (sum, day) => sum + day.viewers,
    0,
  );
  return { collection: { ...collection, uniqueViewers }, clips };
}
