import { describe, expect, it } from "vitest";

import { recordingId, sourceBreaks } from "@/features/player/source-breaks";

describe("recordingId", () => {
  it("reads the trailing file number of a GoPro chapter", () => {
    // The 2-digit chapter number varies; the 4-digit recording id is shared.
    expect(recordingId("GX010042.MP4")).toBe("0042");
    expect(recordingId("GX020042.MP4")).toBe("0042");
    expect(recordingId("GX010043.MP4")).toBe("0043");
  });

  it("treats an older GOPR first chapter as the same recording as its GP parts", () => {
    expect(recordingId("GOPR0042.MP4")).toBe("0042");
    expect(recordingId("GP010042.MP4")).toBe("0042");
  });

  it("returns null for a name that is not a GoPro chapter", () => {
    expect(recordingId("clip.mp4")).toBeNull();
    expect(recordingId("")).toBeNull();
  });
});

describe("sourceBreaks", () => {
  it("places no break between chapters of one continuous recording", () => {
    expect(
      sourceBreaks([
        { label: "GX010042.MP4", durationS: 100 },
        { label: "GX020042.MP4", durationS: 100 },
        { label: "GX030042.MP4", durationS: 100 },
      ]),
    ).toEqual([]);
  });

  it("marks a break where a new recording starts, at its start fraction", () => {
    // Two 100s chapters of one recording, then a new recording: break at 200/400.
    expect(
      sourceBreaks([
        { label: "GX010042.MP4", durationS: 100 },
        { label: "GX020042.MP4", durationS: 100 },
        { label: "GX010043.MP4", durationS: 100 },
        { label: "GX020043.MP4", durationS: 100 },
      ]),
    ).toEqual([{ startFraction: 0.5 }]);
  });

  it("keeps quiet when a name is not a recognizable GoPro chapter", () => {
    expect(
      sourceBreaks([
        { label: "first.mp4", durationS: 100 },
        { label: "second.mp4", durationS: 100 },
      ]),
    ).toEqual([]);
  });

  it("returns nothing when the total length is not positive", () => {
    expect(sourceBreaks([])).toEqual([]);
    expect(sourceBreaks([{ label: "GX010042.MP4", durationS: 0 }])).toEqual([]);
  });
});
