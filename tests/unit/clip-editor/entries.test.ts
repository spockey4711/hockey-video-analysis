import { describe, expect, it } from "vitest";

import {
  type EditorEntryRow,
  toEditorEntries,
} from "@/features/clip-editor/entries";

function row(overrides: Partial<EditorEntryRow> = {}): EditorEntryRow {
  return {
    id: "clip-1",
    status: "ready",
    outputPath: "clips/clip-1-a.mp4",
    cutStartS: 752.7,
    tagId: "tag-1",
    tagType: "goal",
    startS: 754,
    window: { startS: 754, endS: 766 },
    isSingle: false,
    gameTitle: "HTHC",
    gameOpponent: "UHC",
    gameDurationS: 4200,
    edit: null,
    version: 3,
    ...overrides,
  };
}

describe("toEditorEntries", () => {
  it("maps a clip to a display-ready entry", () => {
    expect(
      toEditorEntries([row()], "https://media.example.com/hockey"),
    ).toEqual([
      {
        id: "clip-1",
        tagId: "tag-1",
        tagType: "goal",
        title: "Tor",
        subtitle: "HTHC - gegen UHC - 12:34",
        isSingle: false,
        status: "ready",
        src: "https://media.example.com/hockey/clips/clip-1-a.mp4",
        window: { startS: 754, endS: 766 },
        cutStartS: 752.7,
        gameDurationS: 4200,
        edit: null,
        version: 3,
      },
    ]);
  });

  it("has no source for a clip without a file yet", () => {
    const [entry] = toEditorEntries(
      [row({ status: "pending", outputPath: null })],
      undefined,
    );
    expect(entry.src).toBeNull();
    expect(entry.status).toBe("pending");
  });

  it("leaves out a missing opponent and keeps an unknown type's key", () => {
    const [entry] = toEditorEntries(
      [row({ gameOpponent: null, tagType: "mystery" })],
      undefined,
    );
    expect(entry.subtitle).toBe("HTHC - 12:34");
    expect(entry.title).toBe("mystery");
  });

  it("keeps the query's play order", () => {
    const ids = toEditorEntries(
      [row({ id: "b" }), row({ id: "a" })],
      undefined,
    ).map((entry) => entry.id);
    expect(ids).toEqual(["b", "a"]);
  });
});
