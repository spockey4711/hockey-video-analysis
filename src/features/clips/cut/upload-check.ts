/**
 * Checking a clip file the Mac uploaded before it is served (Mac plan S5).
 *
 * The file came over the network from a device, so nothing about it is taken
 * on trust: its size must be the announced one and its first bytes must open
 * an MP4 before any tool parses it, and only then does ffprobe read its
 * container. It must hold a video stream and last as long as the clip it
 * claims to be: from where the Mac says it starts (`cut_start_s`) to the end
 * of the tag's cut plan, give or take {@link CLIP_DURATION_TOLERANCE_S}.
 *
 * The argument builder and parser are pure and unit-tested; only
 * {@link checkClipUpload} reads the file and spawns ffprobe.
 */
import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";

import { CLIP_PROBE_TIMEOUT_MS } from "./probe";

import {
  hasMp4Signature,
  MP4_SIGNATURE_BYTES,
  readFileHead,
} from "@/features/uploads/staging";

const run = promisify(execFile);

/** Raised when an uploaded clip file fails a check; the message says which. */
export class ClipUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClipUploadError";
  }
}

/**
 * How far an uploaded clip's duration may stray from the expected one: its
 * last video frame and audio packet end a little apart, and the Mac and the
 * server round timestamps differently.
 */
export const CLIP_DURATION_TOLERANCE_S = 1.5;

/** ffprobe's answer for a file's container and stream types. */
export function buildUploadProbeArgs(filePath: string): string[] {
  return [
    "-v",
    "error",
    "-show_entries",
    "format=format_name,duration:stream=codec_type",
    "-of",
    "json",
    filePath,
  ];
}

/** What ffprobe reported about an uploaded file. */
export interface ProbedUpload {
  readonly formatName: string;
  readonly durationS: number | null;
  readonly streamTypes: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse {@link buildUploadProbeArgs}'s output. */
export function parseUploadProbe(stdout: string): ProbedUpload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new ClipUploadError("ffprobe did not print JSON");
  }
  if (!isRecord(parsed) || !isRecord(parsed.format)) {
    throw new ClipUploadError("ffprobe reported no format section");
  }
  const { format_name: formatName, duration } = parsed.format;
  const durationS = Number(duration);
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  return {
    formatName: typeof formatName === "string" ? formatName : "",
    durationS:
      typeof duration === "string" && Number.isFinite(durationS)
        ? durationS
        : null,
    streamTypes: streams.map((stream) =>
      isRecord(stream) && typeof stream.codec_type === "string"
        ? stream.codec_type
        : "",
    ),
  };
}

/**
 * Why a probed file is not the clip it claims to be, or null when it is: an
 * MP4 container with a video stream lasting `expectedDurationS`.
 */
export function uploadProblem(
  probed: ProbedUpload,
  expectedDurationS: number,
): string | null {
  if (!probed.formatName.split(",").includes("mp4")) {
    return `not an MP4 container (${probed.formatName || "unknown"})`;
  }
  if (!probed.streamTypes.includes("video")) return "no video stream";
  if (probed.durationS === null) return "no duration";
  if (
    Math.abs(probed.durationS - expectedDurationS) > CLIP_DURATION_TOLERANCE_S
  ) {
    return (
      `lasts ${probed.durationS.toFixed(3)}s, ` +
      `expected ${expectedDurationS.toFixed(3)}s`
    );
  }
  return null;
}

/** What {@link checkClipUpload} checks a file against. */
export interface ClipUploadExpectation {
  readonly sizeBytes: number;
  readonly durationS: number;
}

/**
 * Check the uploaded clip file at `filePath`: its size and signature first,
 * then its container through ffprobe.
 *
 * @throws ClipUploadError naming the first check the file fails.
 */
export async function checkClipUpload(
  filePath: string,
  expected: ClipUploadExpectation,
  ffprobeBinary = "ffprobe",
): Promise<void> {
  const { size } = await stat(filePath);
  if (size !== expected.sizeBytes) {
    throw new ClipUploadError(
      `holds ${size} bytes, announced ${expected.sizeBytes}`,
    );
  }
  if (!hasMp4Signature(await readFileHead(filePath, MP4_SIGNATURE_BYTES))) {
    throw new ClipUploadError("does not start like an MP4 file");
  }

  let stdout: string;
  try {
    ({ stdout } = await run(ffprobeBinary, buildUploadProbeArgs(filePath), {
      timeout: CLIP_PROBE_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    }));
  } catch (cause) {
    const stderr =
      isRecord(cause) && typeof cause.stderr === "string" ? cause.stderr : "";
    throw new ClipUploadError(
      `ffprobe failed: ${stderr.trim() || String(cause)}`,
    );
  }
  const problem = uploadProblem(parseUploadProbe(stdout), expected.durationS);
  if (problem) throw new ClipUploadError(problem);
}
