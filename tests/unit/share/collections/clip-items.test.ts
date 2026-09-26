import { describe, expect, it } from "vitest";

import {
  toPlaylistEntries,
  toPlaylistItems,
} from "@/features/share/collections/clip-items";
import type { SceneEntryRow } from "@/features/share/collections/scene-entries";
import type { CollectionClipRow } from "@/features/share/collections/share-queries";
import { SCENE_VERSION, type TacticsScene } from "@/features/tactics/scene";

function row(overrides: Partial<CollectionClipRow> = {}): CollectionClipRow {
  return {
    id: "clip-1",
    tagType: "goal",
    startS: 754, // 12:34
    playedOn: "2026-03-01",
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

describe("toPlaylistEntries", () => {
  const SCENE: TacticsScene = {
    version: SCENE_VERSION,
    tokens: [
      {
        id: "p1",
        kind: "player",
        team: "home",
        label: "7",
        playerId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        x: 30,
        y: 20,
      },
      { id: "b1", kind: "ball", x: 31, y: 20 },
    ],
    lines: [],
    steps: [],
  };

  function sceneRow(overrides: Partial<SceneEntryRow> = {}): SceneEntryRow {
    return {
      id: "entry-1",
      sceneId: "scene-1",
      name: "Konter",
      scene: SCENE,
      holdS: 8,
      position: 0,
      after: { playedOn: "2026-03-01", startS: 754 },
      ...overrides,
    };
  }

  it("places a scene entry after its clip and carries only what drawing it needs", () => {
    const entries = toPlaylistEntries(
      [row(), row({ id: "clip-2", startS: 900 })],
      [sceneRow()],
      undefined,
    );
    expect(entries.map((entry) => entry.id)).toEqual([
      "clip-1",
      "entry-1",
      "clip-2",
    ]);
    const item = entries[1];
    expect(item).toEqual({
      kind: "scene",
      id: "entry-1",
      title: "Konter",
      subtitle: "Taktikszene - Standbild",
      holdS: 8,
      scene: {
        ...SCENE,
        tokens: [{ ...SCENE.tokens[0], playerId: null }, SCENE.tokens[1]],
      },
    });
    // The share payload names neither the scene nor the roster player.
    expect(JSON.stringify(item)).not.toContain("scene-1");
    expect(JSON.stringify(item)).not.toContain("3f2504e0");
  });

  it("labels an animated scene with its length", () => {
    const animated: TacticsScene = {
      ...SCENE,
      steps: [
        { duration: 2, moves: [{ token: "p1", x: 40, y: 20, via: null }] },
        { duration: 2.5, moves: [{ token: "b1", x: 50, y: 20, via: null }] },
      ],
    };
    const [item] = toPlaylistEntries(
      [],
      [sceneRow({ scene: animated, after: null })],
      undefined,
    );
    expect(item?.subtitle).toBe("Taktikszene - Animation, 4,5 s");
  });
});
