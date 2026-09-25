import { describe, expect, it } from "vitest";

import {
  presenterNotesForClips,
  presenterNotesView,
} from "@/features/share/presentation/presenter-notes";

describe("presenterNotesForClips", () => {
  it("keeps only the notes of the clips the link plays", () => {
    expect(
      presenterNotesForClips(
        { collection: "Thema: Ecken", clips: { a: "Läufer", gone: "alt" } },
        ["a", "b"],
      ),
    ).toEqual({ collection: "Thema: Ecken", clips: { a: "Läufer" } });
  });

  it("returns nothing when no note is left to show", () => {
    expect(
      presenterNotesForClips({ collection: null, clips: { gone: "alt" } }, [
        "a",
      ]),
    ).toBeUndefined();
    expect(
      presenterNotesForClips({ collection: "", clips: {} }, ["a"]),
    ).toBeUndefined();
  });

  it("keeps a collection note alone", () => {
    expect(presenterNotesForClips({ collection: "x", clips: {} }, [])).toEqual({
      collection: "x",
      clips: {},
    });
  });
});

describe("presenterNotesView", () => {
  const notes = { collection: "Thema: Ecken", clips: { a: "Läufer" } };

  it("shows the collection note with the first clip's note", () => {
    expect(presenterNotesView(notes, "a", 0)).toEqual({
      collection: "Thema: Ecken",
      clip: "Läufer",
    });
  });

  it("drops the collection note after the first clip", () => {
    expect(presenterNotesView(notes, "a", 1)).toEqual({
      collection: null,
      clip: "Läufer",
    });
  });

  it("has no clip note for a clip without one", () => {
    expect(presenterNotesView(notes, "b", 2).clip).toBeNull();
    expect(presenterNotesView(notes, "constructor", 2).clip).toBeNull();
  });
});
