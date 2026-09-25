import { describe, expect, it } from "vitest";

import { planClipCut } from "@/features/clips/boundary";
import {
  buildKeyframeArgs,
  buildStartTimeArgs,
  buildVideoStartArgs,
  ClipProbeError,
  cutStartFrom,
  parseKeyframe,
  parseStartTime,
  parseVideoStart,
  seekTimestamp,
} from "@/features/clips/cut";

const sources = [
  { orderIndex: 0, filePath: "game/q1.mp4", durationS: 600 },
  { orderIndex: 1, filePath: "game/q2.mp4", durationS: 600 },
];

describe("seekTimestamp", () => {
  it("is the -ss argument ffmpeg parses, on a file starting at zero", () => {
    expect(seekTimestamp(7.3, 0)).toBe("7.300000");
    // ffmpeg reads the millisecond text, not the full-precision offset.
    expect(seekTimestamp(12.3456, 0)).toBe("12.346000");
  });

  it("adds the container start time in whole microseconds, as ffmpeg does", () => {
    // Formatting the sum to milliseconds would round 4.502667 up to 4.503 and
    // land on the next keyframe; the lab cut proved ffmpeg does not.
    expect(seekTimestamp(3.024, 1.478667)).toBe("4.502667");
  });
});

describe("the ffprobe argument vectors", () => {
  it("reads only the container start time", () => {
    expect(buildStartTimeArgs("/src/q1.mp4")).toEqual([
      "-v",
      "error",
      "-show_entries",
      "format=start_time",
      "-of",
      "json",
      "/src/q1.mp4",
    ]);
  });

  it("seeks like ffmpeg and reads the first video packet there", () => {
    const args = buildKeyframeArgs("/src/q1.mp4", "7.300000");
    expect(args).toContain("v:0");
    expect(args[args.indexOf("-read_intervals") + 1]).toBe("7.300000%+#1");
    expect(args.at(-1)).toBe("/src/q1.mp4");
  });

  it("reads the video start time of the written file", () => {
    const args = buildVideoStartArgs("/media/clips/a.mp4");
    expect(args[args.indexOf("-show_entries") + 1]).toBe("stream=start_time");
    expect(args.at(-1)).toBe("/media/clips/a.mp4");
  });
});

describe("parsing ffprobe's answers", () => {
  it("reads a container start time, defaulting to zero", () => {
    expect(parseStartTime('{"format":{"start_time":"1.478667"}}')).toBe(
      1.478667,
    );
    expect(parseStartTime('{"format":{}}')).toBe(0);
    expect(parseStartTime('{"format":{"start_time":"N/A"}}')).toBe(0);
  });

  it("reads the keyframe the seek landed on", () => {
    const stdout = JSON.stringify({
      packets: [{ pts_time: "6.006000", flags: "K__" }],
    });
    expect(parseKeyframe(stdout)).toBe(6.006);
  });

  it("refuses an answer that is not a keyframe with a timestamp", () => {
    expect(() => parseKeyframe('{"packets":[]}')).toThrow(ClipProbeError);
    expect(() =>
      parseKeyframe('{"packets":[{"pts_time":"6.0","flags":"___"}]}'),
    ).toThrow(/keyframe/);
    expect(() =>
      parseKeyframe('{"packets":[{"pts_time":"N/A","flags":"K__"}]}'),
    ).toThrow(/timestamp/);
    expect(() => parseKeyframe("not json")).toThrow(ClipProbeError);
  });

  it("reads the written file's video start time", () => {
    expect(
      parseVideoStart('{"streams":[{"start_time":"0.052333"}]}'),
    ).toBeCloseTo(0.052333, 9);
    expect(() => parseVideoStart('{"streams":[]}')).toThrow(/video stream/);
  });
});

describe("cutStartFrom", () => {
  it("is the game time at file time 0: keyframe, less the file's video start", () => {
    // Tag at 307.3 s = 7.3 s into the first chapter; the cut starts at the
    // keyframe at 6.006 s, which sits at 0.052333 s in the written file.
    const plan = planClipCut(sources, 7.3, 19.3);
    expect(
      cutStartFrom(plan, {
        chapterStartTimeS: 0,
        keyframeS: 6.006,
        fileVideoStartS: 0.052333,
      }),
    ).toBeCloseTo(5.953667, 9);
  });

  it("measures the keyframe from the chapter's own start time", () => {
    const plan = planClipCut(sources, 7.3, 19.3);
    expect(
      cutStartFrom(plan, {
        chapterStartTimeS: 1.5,
        keyframeS: 7.506,
        fileVideoStartS: 0,
      }),
    ).toBeCloseTo(6.006, 9);
  });

  it("places a cut in a later chapter at that chapter's game offset", () => {
    const plan = planClipCut(sources, 612, 620);
    expect(
      cutStartFrom(plan, {
        chapterStartTimeS: 0,
        keyframeS: 11.5,
        fileVideoStartS: 0,
      }),
    ).toBe(611.5);
  });

  it("lets the first piece decide for a window across a chapter seam", () => {
    const plan = planClipCut(sources, 595, 605);
    expect(
      cutStartFrom(plan, {
        chapterStartTimeS: 0,
        keyframeS: 594,
        fileVideoStartS: 0.04,
      }),
    ).toBeCloseTo(593.96, 9);
  });
});
