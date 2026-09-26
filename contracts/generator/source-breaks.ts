/**
 * Golden vectors for recording breaks: where a game's timeline jumps from one
 * GoPro recording to a new one. Chapters of one recording share the trailing
 * file number and play on seamlessly; a new number is a break the scrubber
 * marks. A name outside the GoPro scheme never makes a break.
 */
import { DEFAULT_TOLERANCE, vectorCase, type VectorFile } from "./vector";

import {
  recordingId,
  sourceBreaks,
  type SourceBreakInput,
} from "@/features/player/source-breaks";

function recordingCase(name: string, label: string) {
  return vectorCase(name, "recordingId", { label }, (i) =>
    recordingId(i.label),
  );
}

function breaksCase(name: string, sources: SourceBreakInput[]) {
  return vectorCase(name, "sourceBreaks", { sources }, (i) =>
    sourceBreaks(i.sources),
  );
}

export function buildSourceBreaks(): VectorFile {
  return {
    contract: "source-breaks",
    description:
      "The GoPro recording id of a chapter file, and the recording breaks of an " +
      "ordered chapter list as fractions of the game length. Chapters with a bad " +
      "duration take no room on the timeline.",
    reference: ["src/features/player/source-breaks.ts"],
    tolerance: DEFAULT_TOLERANCE,
    cases: [
      recordingCase("an HEVC chapter", "GX010042.MP4"),
      recordingCase("a later chapter of the same recording", "GX020042.MP4"),
      recordingCase("an H.264 chapter", "GH010007.MP4"),
      recordingCase("a chapter in a game folder", "Game A/GX030042.MP4"),
      recordingCase("lower case", "gx010042.mp4"),
      recordingCase("the first chapter of an older camera", "GOPR0042.MP4"),
      recordingCase("a later chapter of an older camera", "GP010042.MP4"),
      recordingCase("an exported half has no recording id", "halbzeit1.mp4"),
      recordingCase("a phone video has no recording id", "IMG_0001.MOV"),

      breaksCase("one recording in three chapters has no break", [
        { label: "GX010042.MP4", durationS: 531.531 },
        { label: "GX020042.MP4", durationS: 531.531 },
        { label: "GX030042.MP4", durationS: 212.345 },
      ]),
      breaksCase("a new recording is a break", [
        { label: "GX010042.MP4", durationS: 600 },
        { label: "GX020042.MP4", durationS: 300 },
        { label: "GX010043.MP4", durationS: 300 },
      ]),
      breaksCase("two new recordings are two breaks", [
        { label: "GX010042.MP4", durationS: 400 },
        { label: "GX010043.MP4", durationS: 400 },
        { label: "GX010044.MP4", durationS: 200 },
      ]),
      breaksCase("exported halves have no break", [
        { label: "halbzeit1.mp4", durationS: 2150.4 },
        { label: "halbzeit2.mp4", durationS: 2210.08 },
      ]),
      breaksCase("a zero-length chapter takes no room", [
        { label: "GX010042.MP4", durationS: 0 },
        { label: "GX010043.MP4", durationS: 300 },
      ]),
      breaksCase("no chapter with a length means no breaks", [
        { label: "GX010042.MP4", durationS: 0 },
        { label: "GX010043.MP4", durationS: 0 },
      ]),
      breaksCase("no chapters means no breaks", []),
    ],
  };
}
