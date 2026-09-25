import { describe, expect, it } from "vitest";

import {
  CLIP_NOTE_FIELD_PREFIX,
  COLLECTION_NOTE_FIELD,
  MAX_NAME_LENGTH,
  MAX_PRESENTER_NOTE_LENGTH,
  MAX_TEAM_NOTE_LENGTH,
  TEAM_CLIP_NOTE_FIELD_PREFIX,
  TEAM_INTRO_FIELD,
  isValidId,
  normalizeClipIds,
  normalizeName,
  normalizePresenterNote,
  normalizeTeamNote,
  parsePresenterNotes,
  parseTeamNotes,
} from "@/features/share/collections/validation";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("isValidId", () => {
  it("accepts a well-formed UUID", () => {
    expect(isValidId(UUID_A)).toBe(true);
  });

  it("rejects a non-string or a malformed id", () => {
    expect(isValidId(undefined)).toBe(false);
    expect(isValidId(123)).toBe(false);
    expect(isValidId("not-a-uuid")).toBe(false);
    expect(isValidId("")).toBe(false);
  });
});

describe("normalizeName", () => {
  it("trims surrounding whitespace and returns the stored value", () => {
    expect(normalizeName("  Standards Woche 3 ")).toBe("Standards Woche 3");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(normalizeName("")).toBeNull();
    expect(normalizeName("   ")).toBeNull();
  });

  it("rejects a name over the max length", () => {
    expect(normalizeName("a".repeat(MAX_NAME_LENGTH))).not.toBeNull();
    expect(normalizeName("a".repeat(MAX_NAME_LENGTH + 1))).toBeNull();
  });

  it("rejects a non-string", () => {
    expect(normalizeName(undefined)).toBeNull();
    expect(normalizeName(42)).toBeNull();
  });
});

describe("normalizeClipIds", () => {
  it("keeps only well-formed, unique ids", () => {
    expect(normalizeClipIds([UUID_A, UUID_B, UUID_A])).toEqual([
      UUID_A,
      UUID_B,
    ]);
  });

  it("drops malformed or non-string entries rather than failing", () => {
    expect(normalizeClipIds([UUID_A, "bad", 7, null])).toEqual([UUID_A]);
  });

  it("returns an empty list when nothing is valid", () => {
    expect(normalizeClipIds([])).toEqual([]);
    expect(normalizeClipIds(["", "nope"])).toEqual([]);
  });
});

describe("normalizePresenterNote", () => {
  it("trims a note and keeps its inner line breaks", () => {
    expect(
      normalizePresenterNote("  Auf die Absicherung achten.\r\nDann 3:1.  "),
    ).toBe("Auf die Absicherung achten.\nDann 3:1.");
  });

  it("clears an empty or whitespace-only note", () => {
    expect(normalizePresenterNote("")).toBeNull();
    expect(normalizePresenterNote(" \n ")).toBeNull();
  });

  it("accepts a note at the limit, counting a line break once", () => {
    const atLimit = `${"a".repeat(MAX_PRESENTER_NOTE_LENGTH - 2)}\r\nb`;
    expect(normalizePresenterNote(atLimit)).toHaveLength(
      MAX_PRESENTER_NOTE_LENGTH,
    );
  });

  it("rejects a note over the limit or a non-string", () => {
    expect(
      normalizePresenterNote("a".repeat(MAX_PRESENTER_NOTE_LENGTH + 1)),
    ).toBeUndefined();
    expect(normalizePresenterNote(null)).toBeUndefined();
    expect(normalizePresenterNote(42)).toBeUndefined();
  });
});

describe("parsePresenterNotes", () => {
  function notesForm(
    collection: string | null,
    clips: Record<string, string> = {},
  ): FormData {
    const data = new FormData();
    data.set("collectionId", UUID_A);
    if (collection !== null) data.set(COLLECTION_NOTE_FIELD, collection);
    for (const [id, note] of Object.entries(clips)) {
      data.set(`${CLIP_NOTE_FIELD_PREFIX}${id}`, note);
    }
    return data;
  }

  it("reads the collection note and each clip's note, clearing empty ones", () => {
    const parsed = parsePresenterNotes(
      notesForm(" Thema: Ecken ", {
        [UUID_A]: "Läufer beachten",
        [UUID_B]: " ",
      }),
    );
    expect(parsed).toEqual({
      collection: "Thema: Ecken",
      clips: new Map([
        [UUID_A, "Läufer beachten"],
        [UUID_B, null],
      ]),
    });
  });

  it("keys clip notes by the lower-case id", () => {
    const parsed = parsePresenterNotes(
      notesForm("", { [UUID_A.toUpperCase()]: "x" }),
    );
    expect(parsed?.clips.get(UUID_A)).toBe("x");
  });

  it("ignores a clip note field with a malformed id", () => {
    const parsed = parsePresenterNotes(notesForm("", { "not-a-uuid": "x" }));
    expect(parsed).toEqual({ collection: null, clips: new Map() });
  });

  it("rejects the whole form when the collection note is missing", () => {
    expect(parsePresenterNotes(notesForm(null))).toBeNull();
  });

  it("rejects the whole form when any note is too long", () => {
    const tooLong = "a".repeat(MAX_PRESENTER_NOTE_LENGTH + 1);
    expect(parsePresenterNotes(notesForm(tooLong))).toBeNull();
    expect(
      parsePresenterNotes(
        notesForm("ok", { [UUID_A]: "ok", [UUID_B]: tooLong }),
      ),
    ).toBeNull();
  });
});

describe("normalizeTeamNote", () => {
  it("trims, unifies line breaks and clears an empty note", () => {
    expect(normalizeTeamNote("  Heute: Ecken.\r\nViel Spass!  ")).toBe(
      "Heute: Ecken.\nViel Spass!",
    );
    expect(normalizeTeamNote(" ")).toBeNull();
  });

  it("caps a team note shorter than a presenter note", () => {
    expect(MAX_TEAM_NOTE_LENGTH).toBeLessThan(MAX_PRESENTER_NOTE_LENGTH);
    expect(normalizeTeamNote("a".repeat(MAX_TEAM_NOTE_LENGTH))).toHaveLength(
      MAX_TEAM_NOTE_LENGTH,
    );
    expect(
      normalizeTeamNote("a".repeat(MAX_TEAM_NOTE_LENGTH + 1)),
    ).toBeUndefined();
    expect(normalizeTeamNote(undefined)).toBeUndefined();
  });
});

describe("parseTeamNotes", () => {
  function teamForm(
    intro: string | null,
    clips: Record<string, string> = {},
  ): FormData {
    const data = new FormData();
    data.set("collectionId", UUID_A);
    if (intro !== null) data.set(TEAM_INTRO_FIELD, intro);
    for (const [id, note] of Object.entries(clips)) {
      data.set(`${TEAM_CLIP_NOTE_FIELD_PREFIX}${id}`, note);
    }
    return data;
  }

  it("reads the intro and each clip's text, clearing empty ones", () => {
    expect(
      parseTeamNotes(
        teamForm(" Thema: Ecken ", { [UUID_A]: "Läufer", [UUID_B]: "" }),
      ),
    ).toEqual({
      collection: "Thema: Ecken",
      clips: new Map([
        [UUID_A, "Läufer"],
        [UUID_B, null],
      ]),
    });
  });

  it("never reads presenter note fields, and presenter notes never read team fields", () => {
    const data = teamForm("Intro", { [UUID_A]: "Für alle" });
    data.set(COLLECTION_NOTE_FIELD, "Privat");
    data.set(`${CLIP_NOTE_FIELD_PREFIX}${UUID_B}`, "Privat");

    expect(parseTeamNotes(data)).toEqual({
      collection: "Intro",
      clips: new Map([[UUID_A, "Für alle"]]),
    });
    expect(parsePresenterNotes(data)).toEqual({
      collection: "Privat",
      clips: new Map([[UUID_B, "Privat"]]),
    });
  });

  it("rejects the whole form when the intro is missing or any text is too long", () => {
    const tooLong = "a".repeat(MAX_TEAM_NOTE_LENGTH + 1);
    expect(parseTeamNotes(teamForm(null))).toBeNull();
    expect(parseTeamNotes(teamForm(tooLong))).toBeNull();
    expect(
      parseTeamNotes(teamForm("ok", { [UUID_A]: "ok", [UUID_B]: tooLong })),
    ).toBeNull();
  });
});
