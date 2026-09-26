import { describe, expect, it } from "vitest";

import {
  buildProbeArgs,
  parseProbeOutput,
  ProbeError,
  recordingDateFrom,
} from "@/features/ingest";

const NOW = new Date("2026-09-24T12:00:00Z");

describe("buildProbeArgs", () => {
  it("asks only for the duration, creation time and video frame rate, as JSON", () => {
    expect(buildProbeArgs("/media/source/game/GX010001.MP4")).toEqual([
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "format=duration:format_tags=creation_time:stream=avg_frame_rate,r_frame_rate",
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
      frameRate: null,
      creationTime: "2026-05-12T14:03:22.000000Z",
    });
  });

  it("returns a null creation time when the file has none", () => {
    expect(parseProbeOutput('{"format":{"duration":"12.5"}}')).toEqual({
      durationS: 12.5,
      frameRate: null,
      creationTime: null,
    });
  });

  function withRates(rates: Record<string, string>): string {
    return JSON.stringify({ streams: [rates], format: { duration: "12.5" } });
  }

  it.each([
    ["50 fps", { avg_frame_rate: "50/1", r_frame_rate: "50/1" }, 50],
    ["NTSC 59.94 fps", { avg_frame_rate: "60000/1001" }, 60000 / 1001],
    [
      "the base rate when the average is 0/0",
      { avg_frame_rate: "0/0", r_frame_rate: "25/1" },
      25,
    ],
    ["no rate when both are 0/0", { avg_frame_rate: "0/0" }, null],
    ["no rate beyond any camera", { avg_frame_rate: "90000/1" }, null],
    ["no rate from garbage", { avg_frame_rate: "fast" }, null],
  ])("reads the video frame rate: %s", (_, rates, frameRate) => {
    expect(parseProbeOutput(withRates(rates)).frameRate).toBe(frameRate);
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
