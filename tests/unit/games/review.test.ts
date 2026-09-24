import { describe, expect, it } from "vitest";

import { gamesContent } from "@/features/games/content";
import {
  chapterFileName,
  partitionIncomingGames,
  validateGameReview,
  type RawGameReview,
} from "@/features/games/review";

const { errors } = gamesContent;

function rawReview(overrides: Partial<RawGameReview> = {}): RawGameReview {
  return {
    title: "Heim vs. Rot-Weiss",
    opponent: "Rot-Weiss",
    playedOn: "2026-05-12",
    ...overrides,
  };
}

describe("partitionIncomingGames", () => {
  it("puts unnamed imported games in the review list, keeping the order", () => {
    const games = [
      { id: "a", title: "" },
      { id: "b", title: "Heim vs. Blau" },
      { id: "c", title: "   " },
      { id: "d", title: "Auswaerts vs. Rot" },
    ];

    const { incoming, accepted } = partitionIncomingGames(games);

    expect(incoming.map((g) => g.id)).toEqual(["a", "c"]);
    expect(accepted.map((g) => g.id)).toEqual(["b", "d"]);
  });

  it("returns two empty lists for no games", () => {
    expect(partitionIncomingGames([])).toEqual({ incoming: [], accepted: [] });
  });
});

describe("validateGameReview", () => {
  it("normalizes a complete review", () => {
    expect(
      validateGameReview(
        rawReview({
          title: "  Heim  ",
          opponent: "  Rot  ",
          playedOn: " 2026-05-12 ",
        }),
      ),
    ).toEqual({
      ok: true,
      value: { title: "Heim", opponent: "Rot", playedOn: "2026-05-12" },
    });
  });

  it("leaves a blank opponent null", () => {
    const result = validateGameReview(rawReview({ opponent: "   " }));
    expect(result.ok && result.value.opponent).toBeNull();
  });

  it("requires a date, since an accepted game must not stay undated", () => {
    expect(validateGameReview(rawReview({ playedOn: "" }))).toEqual({
      ok: false,
      fieldErrors: { playedOn: errors.playedOnRequired },
    });
  });

  it("rejects an impossible date", () => {
    expect(validateGameReview(rawReview({ playedOn: "2026-02-30" }))).toEqual({
      ok: false,
      fieldErrors: { playedOn: errors.playedOnInvalid },
    });
  });

  it("reports every invalid field at once", () => {
    const result = validateGameReview({
      title: " ",
      opponent: "x".repeat(201),
      playedOn: "",
    });
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        title: errors.titleRequired,
        opponent: errors.opponentTooLong,
        playedOn: errors.playedOnRequired,
      },
    });
  });
});

describe("chapterFileName", () => {
  it("keeps only the file name of a path", () => {
    expect(chapterFileName("/media/2026-05-12/GX010123.MP4")).toBe(
      "GX010123.MP4",
    );
    expect(chapterFileName("games\\halbzeit1.mp4")).toBe("halbzeit1.mp4");
  });

  it("returns a bare file name unchanged", () => {
    expect(chapterFileName("GX010123.MP4")).toBe("GX010123.MP4");
  });
});
