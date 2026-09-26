import { describe, expect, it } from "vitest";

import {
  gamePatchConflict,
  parseGameAccept,
  parseGameFieldsPatch,
  parseGameRegistration,
  splitChapterPath,
} from "@/features/app-api/validation";

const ID = "5d9c1f0e-2b7a-4c3d-9e8f-0a1b2c3d4e5f";
const FOLDER = "2026-09-20 Heimspiel";

function chapter(file: string, overrides: Record<string, unknown> = {}) {
  return {
    filePath: `${FOLDER}/${file}`,
    sizeBytes: 4_000_000_000,
    durationS: 1062.495,
    frameRate: 59.94,
    ...overrides,
  };
}

function registration(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    playedOn: "2026-09-20",
    chapters: [chapter("GX010001.MP4"), chapter("GX020001.MP4")],
    ...overrides,
  };
}

describe("splitChapterPath", () => {
  it("splits a <folder>/<file> path", () => {
    expect(splitChapterPath(`${FOLDER}/GX010001.MP4`)).toEqual({
      folder: FOLDER,
      file: "GX010001.MP4",
    });
  });

  it.each([
    ["an absolute path", "/Volumes/SSD/Spiel/GX010001.MP4"],
    ["a leading slash", "/GX010001.MP4"],
    ["a file without a folder", "GX010001.MP4"],
    ["a nested path", "Saison/Spiel/GX010001.MP4"],
    ["a parent segment", "../GX010001.MP4"],
    ["a parent file", "Spiel/.."],
    ["a current segment", "./GX010001.MP4"],
    ["a hidden file", "Spiel/.DS_Store"],
    ["an empty file", "Spiel/"],
    ["a backslash", "Spiel\\..\\GX010001.MP4"],
    ["a Windows path", "C:\\Spiel/GX010001.MP4"],
    ["a tab", "Spiel/GX01\t0001.MP4"],
    ["a newline", "Spiel/GX01\n0001.MP4"],
    ["a NUL byte", "Spiel/GX010001.MP4\u0000"],
    ["padding spaces", " Spiel/GX010001.MP4"],
    ["an overlong name", `Spiel/${"a".repeat(256)}`],
  ])("refuses %s", (_label, path) => {
    expect(splitChapterPath(path)).toBeNull();
  });
});

describe("parseGameRegistration", () => {
  it("accepts a registration and names its folder", () => {
    const result = parseGameRegistration(registration());
    expect(result).toEqual({
      ok: true,
      value: {
        id: ID,
        folderPath: FOLDER,
        playedOn: "2026-09-20",
        chapters: [chapter("GX010001.MP4"), chapter("GX020001.MP4")],
      },
    });
  });

  it("stores the id in lower case and reads a missing date and frame rate as null", () => {
    const result = parseGameRegistration({
      id: ID.toUpperCase(),
      chapters: [chapter("GX010001.MP4", { frameRate: undefined })],
    });
    expect(result.ok && result.value).toMatchObject({
      id: ID,
      playedOn: null,
      chapters: [{ frameRate: null }],
    });
  });

  it.each([
    ["a missing id", { id: undefined }],
    ["a malformed id", { id: "game-1" }],
    ["an impossible date", { playedOn: "2026-02-30" }],
    ["a date that is not a string", { playedOn: 20260920 }],
    ["no chapters", { chapters: [] }],
    ["chapters that are not a list", { chapters: "GX010001.MP4" }],
    [
      "too many chapters",
      {
        chapters: Array.from({ length: 101 }, (_, i) => chapter(`GX${i}.MP4`)),
      },
    ],
    [
      "an absolute chapter path",
      { chapters: [chapter("x", { filePath: "/Volumes/SSD/GX010001.MP4" })] },
    ],
    [
      "a parent chapter path",
      { chapters: [chapter("x", { filePath: "../secret/GX010001.MP4" })] },
    ],
    [
      "chapters in two folders",
      {
        chapters: [
          chapter("GX010001.MP4"),
          chapter("x", { filePath: "Anderes/GX020001.MP4" }),
        ],
      },
    ],
    [
      "a repeated file",
      { chapters: [chapter("GX010001.MP4"), chapter("GX010001.MP4")] },
    ],
    ["a zero size", { chapters: [chapter("GX010001.MP4", { sizeBytes: 0 })] }],
    [
      "a fractional size",
      { chapters: [chapter("GX010001.MP4", { sizeBytes: 1.5 })] },
    ],
    [
      "a size as a string",
      { chapters: [chapter("GX010001.MP4", { sizeBytes: "4000" })] },
    ],
    [
      "a zero duration",
      { chapters: [chapter("GX010001.MP4", { durationS: 0 })] },
    ],
    [
      "an endless duration",
      { chapters: [chapter("GX010001.MP4", { durationS: 90_000 })] },
    ],
    [
      "a negative frame rate",
      { chapters: [chapter("GX010001.MP4", { frameRate: -25 })] },
    ],
  ])("refuses %s", (_label, overrides) => {
    const result = parseGameRegistration(registration(overrides));
    expect(result.ok).toBe(false);
  });

  it("refuses a body that is not an object", () => {
    expect(parseGameRegistration([registration()]).ok).toBe(false);
    expect(parseGameRegistration(null).ok).toBe(false);
  });
});

describe("parseGameFieldsPatch", () => {
  it("keeps only the named fields, trimmed, with empty values as null", () => {
    expect(
      parseGameFieldsPatch({ title: " Heimspiel ", opponent: " " }),
    ).toEqual({ ok: true, value: { title: "Heimspiel", opponent: null } });
    expect(parseGameFieldsPatch({ playedOn: null })).toEqual({
      ok: true,
      value: { playedOn: null },
    });
  });

  it.each([
    ["an empty patch", {}],
    ["an empty title", { title: "  " }],
    ["a title that is not a string", { title: 7 }],
    ["an overlong opponent", { opponent: "x".repeat(201) }],
    ["an impossible date", { playedOn: "2026-13-01" }],
  ])("refuses %s", (_label, body) => {
    expect(parseGameFieldsPatch(body).ok).toBe(false);
  });
});

describe("gamePatchConflict", () => {
  it("names a game under review only by accepting it", () => {
    expect(gamePatchConflict({ title: "Heimspiel" }, true)).not.toBeNull();
    expect(
      gamePatchConflict({ opponent: "TSV", playedOn: null }, true),
    ).toBeNull();
  });

  it("keeps an accepted game's date", () => {
    expect(gamePatchConflict({ playedOn: null }, false)).not.toBeNull();
    expect(gamePatchConflict({ title: "Heimspiel" }, false)).toBeNull();
  });
});

describe("parseGameAccept", () => {
  it("applies the review's rules", () => {
    expect(
      parseGameAccept({
        title: " Heimspiel ",
        opponent: null,
        playedOn: "2026-09-20",
      }),
    ).toEqual({
      ok: true,
      value: { title: "Heimspiel", opponent: null, playedOn: "2026-09-20" },
    });
  });

  it("demands a title and a date", () => {
    expect(parseGameAccept({ title: "", playedOn: "" })).toEqual({
      ok: false,
      error: "invalid title, playedOn",
    });
  });

  it("refuses fields that are not strings", () => {
    expect(
      parseGameAccept({ title: 1, opponent: null, playedOn: "2026-09-20" }).ok,
    ).toBe(false);
  });
});
