import { describe, expect, it } from "vitest";

import {
  buildConcatArgs,
  buildConcatList,
  buildCutArgs,
  formatOffset,
} from "@/features/clips/cut";

describe("formatOffset", () => {
  it("renders millisecond precision ffmpeg accepts", () => {
    expect(formatOffset(0)).toBe("0.000");
    expect(formatOffset(12.3456)).toBe("12.346");
    expect(formatOffset(1644.9)).toBe("1644.900");
  });
});

describe("buildCutArgs", () => {
  const args = buildCutArgs(
    "/srv/media/game/q1.mp4",
    { localStartS: 61.5, durationS: 15 },
    "/srv/media/clips/abc.mp4",
  );

  it("seeks before the input so the copy starts at the nearest keyframe", () => {
    expect(args.indexOf("-ss")).toBeLessThan(args.indexOf("-i"));
    expect(args[args.indexOf("-ss") + 1]).toBe("61.500");
    expect(args[args.indexOf("-i") + 1]).toBe("/srv/media/game/q1.mp4");
  });

  it("copies the streams instead of re-encoding (ADR 0004)", () => {
    expect(args[args.indexOf("-c") + 1]).toBe("copy");
    expect(args[args.indexOf("-t") + 1]).toBe("15.000");
    expect(args[args.indexOf("-avoid_negative_ts") + 1]).toBe("make_zero");
  });

  it("writes the output last and never reads stdin", () => {
    expect(args.at(-1)).toBe("/srv/media/clips/abc.mp4");
    expect(args).toContain("-nostdin");
    expect(args).toContain("-y");
  });
});

describe("buildConcatList", () => {
  it("lists the pieces in play order", () => {
    expect(buildConcatList(["/tmp/part-0.mp4", "/tmp/part-1.mp4"])).toBe(
      "file '/tmp/part-0.mp4'\nfile '/tmp/part-1.mp4'\n",
    );
  });

  it("escapes a single quote so a quoted file name cannot break the list", () => {
    expect(buildConcatList(["/tmp/o'brien.mp4"])).toBe(
      "file '/tmp/o'\\''brien.mp4'\n",
    );
  });
});

describe("buildConcatArgs", () => {
  it("joins the listed pieces without re-encoding", () => {
    const args = buildConcatArgs("/tmp/parts.txt", "/srv/media/clips/abc.mp4");
    expect(args[args.indexOf("-f") + 1]).toBe("concat");
    expect(args[args.indexOf("-safe") + 1]).toBe("0");
    expect(args[args.indexOf("-i") + 1]).toBe("/tmp/parts.txt");
    expect(args[args.indexOf("-c") + 1]).toBe("copy");
    expect(args.at(-1)).toBe("/srv/media/clips/abc.mp4");
  });
});
