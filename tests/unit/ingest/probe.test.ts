import { describe, expect, it } from "vitest";

import {
  buildProbeArgs,
  parseProbeOutput,
  ProbeError,
  recordingDateFrom,
} from "@/features/ingest";

const NOW = new Date("2026-09-24T12:00:00Z");

describe("buildProbeArgs", () => {
  it("asks only for the duration and creation time, as JSON", () => {
    expect(buildProbeArgs("/media/source/game/GX010001.MP4")).toEqual([
      "-v",
      "error",
      "-show_entries",
      "format=duration:format_tags=creation_time",
      "-of",
      "json",
      "/media/source/game/GX010001.MP4",
    ]);
  });
});

describe("parseProbeOutput", () => {
  it("reads the duration and the creation time", () => {
    const stdout = JSON.stringify({
      format: {
        duration: "366.115750",
        tags: { creation_time: "2026-05-12T14:03:22.000000Z" },
      },
    });
    expect(parseProbeOutput(stdout)).toEqual({
      durationS: 366.11575,
      creationTime: "2026-05-12T14:03:22.000000Z",
    });
  });

  it("returns a null creation time when the file has none", () => {
    expect(parseProbeOutput('{"format":{"duration":"12.5"}}')).toEqual({
      durationS: 12.5,
      creationTime: null,
    });
  });

  it.each([
    ["not JSON", "oops"],
    ["no format", "{}"],
    ["no duration", '{"format":{}}'],
    ["zero duration", '{"format":{"duration":"0"}}'],
    ["N/A duration", '{"format":{"duration":"N/A"}}'],
    ["absurd duration", '{"format":{"duration":"999999"}}'],
  ])("rejects %s", (_, stdout) => {
    expect(() => parseProbeOutput(stdout)).toThrow(ProbeError);
  });
});

describe("recordingDateFrom", () => {
  it("takes the calendar date as the camera wrote it", () => {
    expect(recordingDateFrom("2026-05-12T23:30:00.000000Z", NOW)).toBe(
      "2026-05-12",
    );
  });

  it.each([
    ["missing", null],
    ["garbage", "yesterday"],
    ["the QuickTime epoch", "1904-01-01T00:00:00.000000Z"],
    ["the Unix epoch", "1970-01-01T00:00:00.000000Z"],
    ["an unset GoPro clock", "2014-12-31T00:00:00.000000Z"],
    ["a future clock", "2026-09-26T00:00:00.000000Z"],
    ["an impossible date", "2026-02-30T00:00:00.000000Z"],
  ])("does not trust %s", (_, creationTime) => {
    expect(recordingDateFrom(creationTime, NOW)).toBeNull();
  });
});
