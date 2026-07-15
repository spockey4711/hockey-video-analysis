import { describe, expect, it } from "vitest";

import { parseIngestGame } from "@/features/games/ingest";
import { DURATION_MAX_S, MAX_SOURCES } from "@/features/games/validation";

function body(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    playedOn: "2026-05-12",
    sources: [
      { filePath: "/media/GX010123.MP4", durationS: 1218.4 },
      { filePath: "/media/GX020123.MP4", durationS: 900 },
    ],
    ...overrides,
  };
}

describe("parseIngestGame", () => {
  it("accepts a well-formed payload and preserves source order", () => {
    const result = parseIngestGame(body());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.playedOn).toBe("2026-05-12");
    expect(result.value.sources).toEqual([
      { filePath: "/media/GX010123.MP4", durationS: 1218.4 },
      { filePath: "/media/GX020123.MP4", durationS: 900 },
    ]);
  });

  it("treats a missing or null recording date as undated", () => {
    for (const playedOn of [undefined, null]) {
      const result = parseIngestGame(body({ playedOn }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.playedOn).toBeNull();
    }
  });

  it("trims chapter paths", () => {
    const result = parseIngestGame(
      body({ sources: [{ filePath: "  /media/GX01.MP4  ", durationS: 10 }] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.sources[0].filePath).toBe("/media/GX01.MP4");
  });

  it("rejects a non-object body", () => {
    expect(parseIngestGame(null).ok).toBe(false);
    expect(parseIngestGame([]).ok).toBe(false);
    expect(parseIngestGame("nope").ok).toBe(false);
  });

  it("rejects an invalid recording date", () => {
    expect(parseIngestGame(body({ playedOn: "2026-02-30" })).ok).toBe(false);
    expect(parseIngestGame(body({ playedOn: "12.05.2026" })).ok).toBe(false);
    expect(parseIngestGame(body({ playedOn: 20260512 })).ok).toBe(false);
  });

  it("requires a non-empty, capped sources array", () => {
    expect(parseIngestGame(body({ sources: undefined })).ok).toBe(false);
    expect(parseIngestGame(body({ sources: [] })).ok).toBe(false);
    const tooMany = Array.from({ length: MAX_SOURCES + 1 }, () => ({
      filePath: "/media/GX01.MP4",
      durationS: 10,
    }));
    expect(parseIngestGame(body({ sources: tooMany })).ok).toBe(false);
  });

  it("rejects a chapter with a bad path or duration", () => {
    expect(
      parseIngestGame(body({ sources: [{ filePath: "", durationS: 10 }] })).ok,
    ).toBe(false);
    expect(
      parseIngestGame(body({ sources: [{ filePath: "/m.MP4", durationS: 0 }] }))
        .ok,
    ).toBe(false);
    expect(
      parseIngestGame(
        body({ sources: [{ filePath: "/m.MP4", durationS: -5 }] }),
      ).ok,
    ).toBe(false);
    expect(
      parseIngestGame(
        body({ sources: [{ filePath: "/m.MP4", durationS: "1218.4" }] }),
      ).ok,
    ).toBe(false);
    expect(
      parseIngestGame(
        body({
          sources: [{ filePath: "/m.MP4", durationS: DURATION_MAX_S + 1 }],
        }),
      ).ok,
    ).toBe(false);
  });

  it("names the offending field in the error", () => {
    const result = parseIngestGame(
      body({ sources: [{ filePath: "/m.MP4", durationS: -5 }] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("sources[0].durationS");
  });
});
