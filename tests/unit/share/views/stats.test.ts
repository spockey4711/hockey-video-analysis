import { describe, expect, it } from "vitest";

import {
  EMPTY_VIEW_COUNTS,
  summarizeViewStats,
} from "@/features/share/views/stats";

const a = "clip-a";
const b = "clip-b";

describe("summarizeViewStats", () => {
  it("is all zeros for a collection nobody has viewed", () => {
    expect(summarizeViewStats([], [])).toEqual({
      collection: EMPTY_VIEW_COUNTS,
      clips: {},
    });
  });

  it("sums each clip's days and the collection's totals", () => {
    const stats = summarizeViewStats(
      [
        { clipId: a, clicks: 3, fullViews: 2, replays: 1, viewers: 2 },
        { clipId: b, clicks: 1, fullViews: 0, replays: 0, viewers: 1 },
        { clipId: a, clicks: 1, fullViews: 1, replays: 4, viewers: 1 },
      ],
      [{ viewers: 2 }, { viewers: 1 }],
    );

    expect(stats.clips[a]).toEqual({
      clicks: 4,
      fullViews: 3,
      replays: 5,
      uniqueViewers: 3,
    });
    expect(stats.clips[b]).toEqual({
      clicks: 1,
      fullViews: 0,
      replays: 0,
      uniqueViewers: 1,
    });
    expect(stats.collection).toEqual({
      clicks: 5,
      fullViews: 3,
      replays: 5,
      uniqueViewers: 3,
    });
  });

  it("counts a viewer of several clips once for the collection that day", () => {
    // One viewer opened both clips on one day: a viewer of each clip, but one
    // collection viewer - which only the collection-wide day rows can tell.
    const stats = summarizeViewStats(
      [
        { clipId: a, clicks: 1, fullViews: 1, replays: 0, viewers: 1 },
        { clipId: b, clicks: 1, fullViews: 1, replays: 0, viewers: 1 },
      ],
      [{ viewers: 1 }],
    );
    expect(stats.clips[a]?.uniqueViewers).toBe(1);
    expect(stats.clips[b]?.uniqueViewers).toBe(1);
    expect(stats.collection.uniqueViewers).toBe(1);
  });

  it("adds up unique viewers across days, the documented approximation", () => {
    const stats = summarizeViewStats(
      [
        { clipId: a, clicks: 1, fullViews: 0, replays: 0, viewers: 1 },
        { clipId: a, clicks: 1, fullViews: 0, replays: 0, viewers: 1 },
      ],
      [{ viewers: 1 }, { viewers: 1 }],
    );
    expect(stats.clips[a]?.uniqueViewers).toBe(2);
    expect(stats.collection.uniqueViewers).toBe(2);
  });
});
