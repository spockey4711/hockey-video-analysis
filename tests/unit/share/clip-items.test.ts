import { describe, expect, it } from "vitest";

import { toPlaylistItems } from "@/features/share/team/clip-items";
import type { TeamClipRow } from "@/features/share/team/queries";

function row(overrides: Partial<TeamClipRow> = {}): TeamClipRow {
  return {
    id: "clip-1",
    tagType: "goal",
    startS: 754, // 12:34
    outputPath: "clips/game-1/goal-754.mp4",
    gameTitle: "HTHC",
    gameOpponent: "UHC",
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
    });
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

  it("preserves input order", () => {
    const items = toPlaylistItems(
      [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })],
      undefined,
    );
    expect(items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});
