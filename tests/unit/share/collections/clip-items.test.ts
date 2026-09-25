import { describe, expect, it } from "vitest";

import { toPlaylistItems } from "@/features/share/collections/clip-items";
import type { CollectionClipRow } from "@/features/share/collections/share-queries";

function row(overrides: Partial<CollectionClipRow> = {}): CollectionClipRow {
  return {
    id: "clip-1",
    tagType: "goal",
    startS: 754, // 12:34
    outputPath: "clips/game-1/goal-754.mp4",
    gameTitle: "HTHC",
    gameOpponent: "UHC",
    teamNote: null,
    timeline: { cutStartS: 753, window: { startS: 754, endS: 766 } },
    edit: null,
    ...overrides,
  };
}

describe("toPlaylistItems", () => {
  it("maps a clip to a display-ready item", () => {
    const [item] = toPlaylistItems([row()], "https://media.example.com/hockey");
    expect(item).toEqual({
      id: "clip-1",
      src: "https://media.example.com/hockey/clips/game-1/goal-754.mp4",
      title: "Tor",
      subtitle: "HTHC - gegen UHC - 12:34",
      plan: {
        inS: 1,
        outS: 13,
        slow: [],
        zoom: [],
        marks: [],
        exact: true,
        trimClamped: false,
      },
    });
  });

  it("plays an edited clip from its trim, on the clip file's clock", () => {
    const [item] = toPlaylistItems(
      [
        row({
          edit: {
            v: 1,
            trim: { startS: 756.5, endS: 760 },
            slow: [],
            zoom: [],
            marks: [],
          },
        }),
      ],
      undefined,
    );
    expect(item.plan).toMatchObject({ inS: 3.5, outS: 7, exact: true });
  });

  it("attaches the coach comment of a clip that has one, and only there", () => {
    const [withNote, without] = toPlaylistItems(
      [row({ id: "a" }), row({ id: "b" })],
      undefined,
      new Map([["a", { body: "Früher abspielen." }]]),
    );
    expect(withNote.coachComment).toBe("Früher abspielen.");
    expect(without).not.toHaveProperty("coachComment");
  });

  it("attaches the team note of a clip that has one, and only there", () => {
    const [withNote, without] = toPlaylistItems(
      [row({ id: "a", teamNote: "Auf den Läufer achten." }), row({ id: "b" })],
      undefined,
    );
    expect(withNote.teamNote).toBe("Auf den Läufer achten.");
    expect(without).not.toHaveProperty("teamNote");
  });

  it("serves the raw output path when no media base is set", () => {
    const [item] = toPlaylistItems([row()], undefined);
    expect(item.src).toBe("clips/game-1/goal-754.mp4");
  });

  it("omits the opponent from the subtitle when absent", () => {
    const [item] = toPlaylistItems([row({ gameOpponent: null })], undefined);
    expect(item.subtitle).toBe("HTHC - 12:34");
  });

  it("falls back to the raw type key for an unknown tag type", () => {
    const [item] = toPlaylistItems([row({ tagType: "mystery" })], undefined);
    expect(item.title).toBe("mystery");
  });

  it("preserves input order (the curated play order)", () => {
    const items = toPlaylistItems(
      [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })],
      undefined,
    );
    expect(items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});
