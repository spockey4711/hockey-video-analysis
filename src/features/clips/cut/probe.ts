/**
 * Finding where a copy-cut clip file really starts, in global game time (ADR
 * 0011).
 *
 * `ffmpeg -ss <t> -i <chapter> -c copy` starts the file at the keyframe the
 * demuxer seeks to for `t`, not at `t`, so the file begins up to a keyframe
 * interval before its tag. Anything placed at an exact moment of a clip (a
 * trim, a zoom, a marker) needs to know how far. Rather than re-deriving the
 * demuxer's rules, the probe asks ffprobe to make the same seek - ffmpeg adds
 * the chapter's start time to `-ss`, and both tools then seek to the last
 * keyframe at or before that timestamp - and reads the first video packet it
 * lands on. That keyframe is the first frame of the cut. The written file's
 * video start time (a few frames of decoder delay after `-avoid_negative_ts
 * make_zero`) is where that frame sits on the player's clock, so
 *
 *   game time at clip-file time 0
 *     = chapter start + (keyframe - chapter start time) - file video start
 *
 * which is what `clips.cut_start_s` stores. A clip spanning a chapter seam is
 * joined from pieces of which only the first starts before its requested
 * offset (a later piece starts at local 0, itself a keyframe), so the first
 * piece decides. After the seam the file can drift from game time by about a
 * frame, because a chapter's `duration_s` and the joined stream end differ that
 * much.
 *
 * The argument builders and parsers are pure and unit-tested; only
 * {@link probeCutStart} spawns processes. Each call reads a container header or
 * a single packet, so through the Drive mount it fetches a few byte ranges.
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { formatOffset } from "./ffmpeg";

import type { ClipCutPlan } from "@/features/clips/boundary";

const run = promisify(execFile);

/** Raised when ffprobe fails or its answer holds no usable timestamp. */
export class ClipProbeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClipProbeError";
  }
}

/**
 * How long one ffprobe call may take. A header or one packet reads in seconds
 * even through the Drive mount; a read that never returns must not hold up the
 * cut queue.
 */
export const CLIP_PROBE_TIMEOUT_MS = 60 * 1000;

const MICROS_PER_SECOND = 1_000_000;

/** ffprobe's answer for a container's start time: `format.start_time`. */
export function buildStartTimeArgs(inputPath: string): string[] {
  return [
    "-v",
    "error",
    "-show_entries",
    "format=start_time",
    "-of",
    "json",
    inputPath,
  ];
}

/**
 * The seek timestamp ffmpeg uses for `-ss <localStartS>` on a file whose
 * container starts at `startTimeS`: the `-ss` argument as ffmpeg parses it
 * (millisecond text, see {@link formatOffset}) plus the start time, in whole
 * microseconds like ffmpeg's own arithmetic, rendered back as seconds.
 */
export function seekTimestamp(localStartS: number, startTimeS: number): string {
  const micros =
    Math.round(Number(formatOffset(localStartS)) * MICROS_PER_SECOND) +
    Math.round(startTimeS * MICROS_PER_SECOND);
  return (micros / MICROS_PER_SECOND).toFixed(6);
}

/**
 * ffprobe seeking to `seek` exactly as ffmpeg's `-ss` does and printing the
 * first video packet it reads there: the keyframe a cut from `seek` starts at.
 */
export function buildKeyframeArgs(inputPath: string, seek: string): string[] {
  return [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "packet=pts_time,flags",
    "-read_intervals",
    `${seek}%+#1`,
    "-of",
    "json",
    inputPath,
  ];
}

/** ffprobe's answer for the first video stream's start time. */
export function buildVideoStartArgs(inputPath: string): string[] {
  return [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=start_time",
    "-of",
    "json",
    inputPath,
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(stdout: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new ClipProbeError("ffprobe did not print JSON");
  }
  if (!isRecord(parsed)) throw new ClipProbeError("ffprobe printed no object");
  return parsed;
}

/** A timestamp field, or null when ffprobe left it out or printed `N/A`. */
function seconds(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The container start time; a file without one starts at 0. */
export function parseStartTime(stdout: string): number {
  const { format } = parseJson(stdout);
  if (!isRecord(format)) {
    throw new ClipProbeError("ffprobe reported no format section");
  }
  return seconds(format.start_time) ?? 0;
}

/** The presentation time of the keyframe the seek landed on. */
export function parseKeyframe(stdout: string): number {
  const { packets } = parseJson(stdout);
  const first = Array.isArray(packets) ? packets[0] : undefined;
  if (!isRecord(first)) {
    throw new ClipProbeError("ffprobe found no video packet at the cut start");
  }
  const pts = seconds(first.pts_time);
  if (pts === null) {
    throw new ClipProbeError("the first video packet has no timestamp");
  }
  if (typeof first.flags !== "string" || !first.flags.includes("K")) {
    throw new ClipProbeError("the seek did not land on a keyframe");
  }
  return pts;
}

/** The video stream's start time in the cut file; 0 when it has none. */
export function parseVideoStart(stdout: string): number {
  const { streams } = parseJson(stdout);
  const first = Array.isArray(streams) ? streams[0] : undefined;
  if (!isRecord(first)) {
    throw new ClipProbeError("the cut file has no video stream");
  }
  return seconds(first.start_time) ?? 0;
}

/** What {@link cutStartFrom} combines: the three probed timestamps. */
export interface ProbedCutStart {
  /** The first chapter's container start time. */
  readonly chapterStartTimeS: number;
  /** The keyframe the cut starts at, on the chapter's timestamps. */
  readonly keyframeS: number;
  /** Where that keyframe sits in the written clip file. */
  readonly fileVideoStartS: number;
}

/**
 * The game time at clip-file time 0 for `plan`, given what was probed. Rounded
 * to the microsecond, the precision of every timestamp involved.
 */
export function cutStartFrom(
  plan: Pick<ClipCutPlan, "startS" | "cuts">,
  { chapterStartTimeS, keyframeS, fileVideoStartS }: ProbedCutStart,
): number {
  const [first] = plan.cuts;
  if (!first) throw new ClipProbeError("the cut plan has no pieces");
  const chapterGameStartS = plan.startS - first.localStartS;
  const keyframeLocalS = keyframeS - chapterStartTimeS;
  const cutStartS = chapterGameStartS + keyframeLocalS - fileVideoStartS;
  return Math.round(cutStartS * MICROS_PER_SECOND) / MICROS_PER_SECOND;
}

/** What {@link probeCutStart} needs besides the plan. */
export interface ProbeCutStartOptions {
  /** Directory the plan's chapter paths resolve against (see `cutClip`). */
  readonly sourceRoot: string;
  /** Absolute path of the written clip file. */
  readonly outputPath: string;
  /** ffprobe executable; overridden in tests and on hosts with a custom build. */
  readonly ffprobeBinary?: string;
  /** Stop each ffprobe call after this long; {@link CLIP_PROBE_TIMEOUT_MS} by default. */
  readonly timeoutMs?: number;
}

/**
 * Probe where the clip file at `outputPath`, cut from `plan`, really starts,
 * as game time at clip-file time 0.
 *
 * @throws ClipProbeError if ffprobe fails or reports nothing usable.
 */
export async function probeCutStart(
  plan: ClipCutPlan,
  {
    sourceRoot,
    outputPath,
    ffprobeBinary = "ffprobe",
    timeoutMs = CLIP_PROBE_TIMEOUT_MS,
  }: ProbeCutStartOptions,
): Promise<number> {
  const [first] = plan.cuts;
  if (!first) throw new ClipProbeError("the cut plan has no pieces");
  const chapter = path.resolve(sourceRoot, first.filePath);
  const probe = async (args: string[]): Promise<string> => {
    try {
      const { stdout } = await run(ffprobeBinary, args, {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
      });
      return stdout;
    } catch (cause) {
      const stderr =
        isRecord(cause) && typeof cause.stderr === "string" ? cause.stderr : "";
      throw new ClipProbeError(
        `ffprobe failed: ${stderr.trim() || String(cause)}`,
      );
    }
  };

  const chapterStartTimeS = parseStartTime(
    await probe(buildStartTimeArgs(chapter)),
  );
  const seek = seekTimestamp(first.localStartS, chapterStartTimeS);
  const keyframeS = parseKeyframe(
    await probe(buildKeyframeArgs(chapter, seek)),
  );
  const fileVideoStartS = parseVideoStart(
    await probe(buildVideoStartArgs(outputPath)),
  );
  return cutStartFrom(plan, { chapterStartTimeS, keyframeS, fileVideoStartS });
}
