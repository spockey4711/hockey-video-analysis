import { describe, expect, it } from "vitest";

import type { CommentRow } from "@/features/clips/comments/queries";
import type { CurationItem } from "@/features/share/collections/curation-items";
import { toCollectionInsights } from "@/features/share/collections/insights";
import {
  type CollectionViewStats,
  EMPTY_VIEW_COUNTS,
} from "@/features/share/views/stats";

function item(overrides: Partial<CurationItem> = {}): CurationItem {
  return {
    id: "clip-1",
    title: "Tor",
    subtitle: "HTHC - gegen UHC - 12:34",
    isSingle: false,
    checked: true,
    ...overrides,
  };
}

function comment(overrides: Partial<CommentRow> = {}): CommentRow {
  return {
    id: "c1",
    clipId: "clip-1",
    author: "Alex",
    body: "Stark gespielt.",
    createdAt: new Date("2026-09-22T12:05:00Z"),
    ...overrides,
  };
}

const NO_VIEWS: CollectionViewStats = {
  collection: EMPTY_VIEW_COUNTS,
  clips: {},
};

describe("toCollectionInsights", () => {
  it("lists only the clips in the collection, in checklist order", () => {
    const insights = toCollectionInsights(
      [
        item({ id: "a", checked: true }),
        item({ id: "b", checked: false }),
        item({ id: "c", checked: true }),
      ],
      NO_VIEWS,
      [],
    );
    expect(insights.clips.map((clip) => clip.id)).toEqual(["a", "c"]);
  });

  it("gives each clip its own figures and zeros to a clip nobody opened", () => {
    const counts = { clicks: 5, fullViews: 3, replays: 2, uniqueViewers: 4 };
    const insights = toCollectionInsights(
      [item({ id: "a" }), item({ id: "b" })],
      { collection: counts, clips: { a: counts } },
      [],
    );
    expect(insights.summary).toEqual(counts);
    expect(insights.clips[0].counts).toEqual(counts);
    expect(insights.clips[1].counts).toEqual(EMPTY_VIEW_COUNTS);
    expect(insights.hasActivity).toBe(true);
  });

  it("attaches each clip's comments in the given order, formatted in the team's time zone", () => {
    const insights = toCollectionInsights(
      [item({ id: "a" }), item({ id: "b" })],
      NO_VIEWS,
      [
        comment({ id: "c1", clipId: "b" }),
        comment({
          id: "c2",
          clipId: "a",
          author: "Sam",
          body: "Nochmal ansehen.",
          createdAt: new Date("2026-09-23T08:30:00Z"),
        }),
        comment({ id: "c3", clipId: "b", author: "Kim" }),
        comment({ id: "c4", clipId: "not-in-collection" }),
      ],
    );
    expect(insights.clips[0].comments).toEqual([
      {
        id: "c2",
        author: "Sam",
        body: "Nochmal ansehen.",
        createdAt: "2026-09-23T08:30:00.000Z",
        // 08:30 UTC is 10:30 in Berlin summer time.
        date: "23.09.2026, 10:30",
      },
    ]);
    expect(insights.clips[1].comments.map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("formats in another time zone when one is given", () => {
    const insights = toCollectionInsights(
      [item()],
      NO_VIEWS,
      [comment()],
      "UTC",
    );
    expect(insights.clips[0].comments[0].date).toBe("22.09.2026, 12:05");
  });

  it("has no activity while nothing was viewed or commented", () => {
    expect(toCollectionInsights([item()], NO_VIEWS, []).hasActivity).toBe(
      false,
    );
  });

  it("counts a comment alone as activity", () => {
    expect(
      toCollectionInsights([item()], NO_VIEWS, [comment()]).hasActivity,
    ).toBe(true);
  });
});
