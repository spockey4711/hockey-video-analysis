import { describe, expect, it } from "vitest";

import {
  parseDuration,
  validateGame,
  validateOpponent,
  validatePlayedOn,
  validateSourcePath,
  validateTitle,
  type RawGameInput,
} from "@/features/games/validation";

function rawGame(overrides: Partial<RawGameInput> = {}): RawGameInput {
  return {
    title: "Heim vs. Rot-Weiss",
    opponent: "",
    playedOn: "",
    sources: [{ filePath: "/media/GX010123.MP4", durationS: "1218.4" }],
    ...overrides,
  };
}

describe("validateTitle", () => {
  it("accepts a non-empty title", () => {
    expect(validateTitle("Spiel 1")).toBeNull();
  });

  it("rejects an empty or whitespace-only title", () => {
    expect(validateTitle("")).not.toBeNull();
    expect(validateTitle("   ")).not.toBeNull();
  });

  it("rejects an over-long title", () => {
    expect(validateTitle("x".repeat(201))).not.toBeNull();
  });
});

describe("validateOpponent", () => {
  it("allows an empty opponent (it is optional)", () => {
    expect(validateOpponent("")).toBeNull();
  });

  it("rejects an over-long opponent", () => {
    expect(validateOpponent("x".repeat(201))).not.toBeNull();
  });
});

describe("validatePlayedOn", () => {
  it("allows an empty date (it is optional)", () => {
    expect(validatePlayedOn("")).toBeNull();
  });

  it("accepts a real ISO date", () => {
    expect(validatePlayedOn("2026-05-12")).toBeNull();
  });

  it("rejects a malformed or impossible date", () => {
    expect(validatePlayedOn("12.05.2026")).not.toBeNull();
    expect(validatePlayedOn("2026-13-01")).not.toBeNull();
    expect(validatePlayedOn("2026-02-30")).not.toBeNull();
  });
});

describe("validateSourcePath", () => {
  it("accepts a non-empty path", () => {
    expect(validateSourcePath("/media/GX010123.MP4")).toBeNull();
  });

  it("rejects an empty path", () => {
    expect(validateSourcePath("  ")).not.toBeNull();
  });
});

describe("parseDuration", () => {
  it("parses a fractional duration", () => {
    expect(parseDuration("1218.4")).toEqual({ value: 1218.4, error: null });
  });

  it("accepts a German decimal comma", () => {
    expect(parseDuration("1218,4")).toEqual({ value: 1218.4, error: null });
  });

  it("rejects empty, non-numeric, zero and negative durations", () => {
    expect(parseDuration("").error).not.toBeNull();
    expect(parseDuration("abc").error).not.toBeNull();
    expect(parseDuration("0").error).not.toBeNull();
    expect(parseDuration("-5").error).not.toBeNull();
  });

  it("rejects an unrealistically long duration", () => {
    expect(parseDuration("90000").error).not.toBeNull();
  });
});

describe("validateGame", () => {
  it("normalizes a valid submission and preserves source order", () => {
    const result = validateGame(
      rawGame({
        title: "  Spiel 1  ",
        opponent: "  Rot-Weiss  ",
        playedOn: "2026-05-12",
        sources: [
          { filePath: " /a/GX010123.MP4 ", durationS: "600" },
          { filePath: "/a/GX020123.MP4", durationS: "1,5" },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      title: "Spiel 1",
      opponent: "Rot-Weiss",
      playedOn: "2026-05-12",
      sources: [
        { filePath: "/a/GX010123.MP4", durationS: 600 },
        { filePath: "/a/GX020123.MP4", durationS: 1.5 },
      ],
    });
  });

  it("maps optional empty fields to null", () => {
    const result = validateGame(rawGame({ opponent: "", playedOn: "" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.opponent).toBeNull();
    expect(result.value.playedOn).toBeNull();
  });

  it("requires at least one source", () => {
    const result = validateGame(rawGame({ sources: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.sources).toBeDefined();
  });

  it("reports per-row source errors keyed by index", () => {
    const result = validateGame(
      rawGame({
        sources: [
          { filePath: "/a/ok.MP4", durationS: "600" },
          { filePath: "", durationS: "nope" },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.sourceRows?.[0]).toBeUndefined();
    expect(result.fieldErrors.sourceRows?.[1]?.filePath).toBeDefined();
    expect(result.fieldErrors.sourceRows?.[1]?.durationS).toBeDefined();
  });

  it("collects a title error alongside source errors", () => {
    const result = validateGame(
      rawGame({ title: "", sources: [{ filePath: "", durationS: "" }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.title).toBeDefined();
    expect(result.fieldErrors.sourceRows?.[0]).toBeDefined();
  });
});
