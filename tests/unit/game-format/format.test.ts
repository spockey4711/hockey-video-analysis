import { describe, expect, it } from "vitest";

import {
  DEFAULT_GAME_FORMAT,
  firstDroppedPeriod,
  parseGameFormatChoice,
  parseGameFormatInput,
  resolveGameFormat,
  type GameFormat,
} from "@/features/game-format/format";

const INDOOR: GameFormat = { periodCount: 2, periodLengthS: 1200 };

describe("resolveGameFormat", () => {
  it("plays the team default when the game sets no format", () => {
    const game = { periodCount: null, periodLengthS: null };
    expect(resolveGameFormat(game, DEFAULT_GAME_FORMAT)).toEqual({
      periodCount: 4,
      periodLengthS: 900,
    });
    expect(resolveGameFormat(game, INDOOR)).toEqual(INDOOR);
  });

  it("plays the game's own format over the team default", () => {
    expect(
      resolveGameFormat({ periodCount: 4, periodLengthS: 600 }, INDOOR),
    ).toEqual({ periodCount: 4, periodLengthS: 600 });
  });

  it("falls back per column", () => {
    expect(
      resolveGameFormat({ periodCount: null, periodLengthS: 600 }, INDOOR),
    ).toEqual({ periodCount: 2, periodLengthS: 600 });
  });

  it("never plays a stored value outside the rules", () => {
    expect(
      resolveGameFormat({ periodCount: 3, periodLengthS: 0 }, INDOOR),
    ).toEqual(INDOOR);
    expect(
      resolveGameFormat({ periodCount: 4, periodLengthS: 90 }, INDOOR),
    ).toEqual({ periodCount: 4, periodLengthS: 1200 });
  });
});

describe("parseGameFormatInput", () => {
  it("reads the count and the minutes, storing seconds", () => {
    expect(
      parseGameFormatInput({ periodCount: "2", periodLengthMin: " 20 " }),
    ).toEqual({ ok: true, value: { periodCount: 2, periodLengthS: 1200 } });
  });

  it.each([
    ["3", "15", ["periodCount"]],
    ["", "15", ["periodCount"]],
    ["4", "0", ["periodLengthMin"]],
    ["4", "61", ["periodLengthMin"]],
    ["4", "7.5", ["periodLengthMin"]],
    ["4", "-5", ["periodLengthMin"]],
    ["4", "", ["periodLengthMin"]],
    ["five", "abc", ["periodCount", "periodLengthMin"]],
  ])("rejects count %j with %j minutes", (count, minutes, invalid) => {
    expect(
      parseGameFormatInput({ periodCount: count, periodLengthMin: minutes }),
    ).toEqual({ ok: false, invalid });
  });
});

describe("parseGameFormatChoice", () => {
  it("means the team default unless an own format is chosen", () => {
    for (const choice of ["team", "", "anything"]) {
      expect(
        parseGameFormatChoice({
          choice,
          periodCount: "3",
          periodLengthMin: "x",
        }),
      ).toEqual({ ok: true, value: null });
    }
  });

  it("reads and validates the fields of an own format", () => {
    expect(
      parseGameFormatChoice({
        choice: "custom",
        periodCount: "4",
        periodLengthMin: "10",
      }),
    ).toEqual({ ok: true, value: { periodCount: 4, periodLengthS: 600 } });
    expect(
      parseGameFormatChoice({
        choice: "custom",
        periodCount: "4",
        periodLengthMin: "90",
      }),
    ).toEqual({ ok: false, invalid: ["periodLengthMin"] });
  });
});

describe("firstDroppedPeriod", () => {
  it("names the first marked quarter two halves leave out", () => {
    expect(firstDroppedPeriod(4, 2)).toBe(3);
    expect(firstDroppedPeriod(3, 2)).toBe(3);
  });

  it("is null while every marked period fits", () => {
    expect(firstDroppedPeriod(0, 2)).toBeNull();
    expect(firstDroppedPeriod(2, 2)).toBeNull();
    expect(firstDroppedPeriod(4, 4)).toBeNull();
  });
});
