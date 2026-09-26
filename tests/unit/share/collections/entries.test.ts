import { describe, expect, it } from "vitest";

import {
  compareClipKeys,
  mergeEntries,
  moveScene,
  placementsOf,
  type OrderedClip,
  type PlacedScene,
} from "@/features/share/collections/entries";

/** Clips in play order: the newer game first, then by game time. */
const CLIPS: OrderedClip[] = [
  { id: "a", key: { playedOn: "2026-03-08", startS: 100 } },
  { id: "b", key: { playedOn: "2026-03-08", startS: 300 } },
  { id: "c", key: { playedOn: "2026-03-01", startS: 50 } },
];

function scene(
  id: string,
  after: OrderedClip | null,
  position = 0,
): PlacedScene {
  return { id, after: after?.key ?? null, position };
}

function ids(entries: ReturnType<typeof mergeEntries>): string[] {
  return entries.map((entry) =>
    entry.kind === "clip" ? entry.clip.id : `scene:${entry.scene.id}`,
  );
}

describe("compareClipKeys", () => {
  it("orders the newer game first, then by game time", () => {
    const [a, b, c] = CLIPS.map((clip) => clip.key) as [
      OrderedClip["key"],
      OrderedClip["key"],
      OrderedClip["key"],
    ];
    expect(compareClipKeys(a, b)).toBeLessThan(0);
    expect(compareClipKeys(b, c)).toBeLessThan(0);
    expect(compareClipKeys(c, a)).toBeGreaterThan(0);
  });

  it("puts a game without a date first, as the queries do", () => {
    expect(
      compareClipKeys(
        { playedOn: null, startS: 900 },
        { playedOn: "2026-03-08", startS: 0 },
      ),
    ).toBeLessThan(0);
  });
});

describe("mergeEntries", () => {
  it("keeps the clips in order when there are no scenes", () => {
    expect(ids(mergeEntries(CLIPS, []))).toEqual(["a", "b", "c"]);
  });

  it("places scenes after their clip, before the first clip, and by position", () => {
    const [a, b] = CLIPS as [OrderedClip, OrderedClip];
    const entries = mergeEntries(CLIPS, [
      scene("late", b, 1),
      scene("start", null),
      scene("early", b, 0),
      scene("afterA", a),
    ]);
    expect(ids(entries)).toEqual([
      "scene:start",
      "a",
      "scene:afterA",
      "b",
      "scene:early",
      "scene:late",
      "c",
    ]);
  });

  it("keeps a scene at its spot when the clip it follows is not in the list", () => {
    const gone = { id: "gone", key: { playedOn: "2026-03-08", startS: 200 } };
    const entries = mergeEntries(CLIPS, [scene("s", gone)]);
    expect(ids(entries)).toEqual(["a", "scene:s", "b", "c"]);
  });

  it("puts a scene after a clip past the last one at the end", () => {
    const old = { id: "old", key: { playedOn: "2025-01-01", startS: 0 } };
    expect(ids(mergeEntries(CLIPS, [scene("s", old)]))).toEqual([
      "a",
      "b",
      "c",
      "scene:s",
    ]);
  });

  it("plays scenes alone when the collection has no clips", () => {
    expect(
      ids(mergeEntries([], [scene("two", null, 1), scene("one", null, 0)])),
    ).toEqual(["scene:one", "scene:two"]);
  });
});

describe("placementsOf", () => {
  it("places each scene after the clip before it, numbered at each spot", () => {
    const [a] = CLIPS as [OrderedClip];
    const entries = mergeEntries(CLIPS, [
      scene("start", null),
      scene("x", a, 4),
      scene("y", a, 9),
    ]);
    expect(placementsOf(entries)).toEqual([
      { id: "start", afterClipId: null, position: 0 },
      { id: "x", afterClipId: "a", position: 0 },
      { id: "y", afterClipId: "a", position: 1 },
    ]);
  });
});

describe("moveScene", () => {
  const [a] = CLIPS as [OrderedClip];
  const entries = mergeEntries(CLIPS, [scene("s", a), scene("t", a, 1)]);

  it("moves a scene down past a clip", () => {
    const moved = moveScene(entries, "t", "down");
    expect(moved && ids(moved)).toEqual(["a", "scene:s", "b", "scene:t", "c"]);
    expect(moved && placementsOf(moved)).toEqual([
      { id: "s", afterClipId: "a", position: 0 },
      { id: "t", afterClipId: "b", position: 0 },
    ]);
  });

  it("moves a scene up past another scene and past a clip", () => {
    const swapped = moveScene(entries, "t", "up");
    expect(swapped && ids(swapped)).toEqual([
      "a",
      "scene:t",
      "scene:s",
      "b",
      "c",
    ]);
    const first = moveScene(entries, "s", "up");
    expect(first && placementsOf(first)[0]).toEqual({
      id: "s",
      afterClipId: null,
      position: 0,
    });
  });

  it("refuses to move past either end or an entry it does not know", () => {
    const top = mergeEntries(CLIPS, [scene("s", null)]);
    expect(moveScene(top, "s", "up")).toBeNull();
    const bottom = mergeEntries(CLIPS, [scene("s", CLIPS[2] as OrderedClip)]);
    expect(moveScene(bottom, "s", "down")).toBeNull();
    expect(moveScene(top, "nope", "down")).toBeNull();
  });
});
