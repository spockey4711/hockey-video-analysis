/**
 * Reading a part's length, frame rate and recording date with ffprobe (P2-17).
 *
 * ffprobe reads only the container header, so through the rclone mount it
 * fetches a few byte ranges of a multi-GB file, never the whole file. The
 * duration becomes `game_sources.duration_s` (always the original's, never the
 * proxy's; ADR 0008). The recording date comes from the `creation_time` tag,
 * which cameras write but exports often drop or reset, so it is only used when
 * it looks like a real recording date. The first video stream's frame rate
 * becomes `game_sources.frame_rate`, which sizes the single-frame step; the
 * proxy keeps the original's rate, so the step matches what the browser plays.
 *
 * The argument builder and the parsers are pure and unit-tested; only
 * {@link probeMedia} spawns a process.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { DURATION_MAX_S } from "@/features/games/validation";
import { usableFrameRate } from "@/lib/frame-step";

const run = promisify(execFile);

/** Raised when ffprobe fails or reports no usable duration. */
export class ProbeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProbeError";
  }
}

/** What the importer needs to know about one part. */
export interface MediaProbe {
  readonly durationS: number;
  /** Frames per second of the first video stream, or null when unreadable. */
  readonly frameRate: number | null;
  /** The raw `creation_time` tag, or null when the file has none. */
  readonly creationTime: string | null;
}

/**
 * The argument vector asking ffprobe for the duration, the creation time and
 * the first video stream's frame rates.
 */
export function buildProbeArgs(inputPath: string): string[] {
  return [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "format=duration:format_tags=creation_time:stream=avg_frame_rate,r_frame_rate",
    "-of",
    "json",
    inputPath,
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A rate ffprobe prints as a fraction (`50/1`, `60000/1001`), or null. */
function parseRate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d+)\/(\d+)$/.exec(value.trim());
  if (!match) return null;
  return usableFrameRate(Number(match[1]) / Number(match[2]));
}

/**
 * The frame rate of the first video stream. The average rate is what the
 * footage really plays at; ffprobe reports `0/0` for it on some containers, and
 * then the stream's base rate stands in. Null when neither is usable, or the
 * file has no video stream: the step then falls back to its default.
 */
function frameRateOf(parsed: Record<string, unknown>): number | null {
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const stream: unknown = streams[0];
  if (!isRecord(stream)) return null;
  return parseRate(stream.avg_frame_rate) ?? parseRate(stream.r_frame_rate);
}

/** Parse ffprobe's JSON output into a {@link MediaProbe}. */
export function parseProbeOutput(stdout: string): MediaProbe {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new ProbeError("ffprobe did not print JSON");
  }
  if (!isRecord(parsed) || !isRecord(parsed.format)) {
    throw new ProbeError("ffprobe reported no format section");
  }
  const { format } = parsed;

  const durationS = Number(format.duration);
  if (!Number.isFinite(durationS) || durationS <= 0) {
    throw new ProbeError(`no usable duration: ${String(format.duration)}`);
  }
  if (durationS > DURATION_MAX_S) {
    throw new ProbeError(`duration is unrealistically long: ${durationS}s`);
  }

  const tags = isRecord(format.tags) ? format.tags : {};
  const creationTime =
    typeof tags.creation_time === "string" ? tags.creation_time : null;
  return { durationS, frameRate: frameRateOf(parsed), creationTime };
}

/** The first year a creation time is believed; older stamps are camera defaults. */
const EARLIEST_TRUSTED_YEAR = 2015;

/**
 * The recording date (`YYYY-MM-DD`) a `creation_time` tag stands for, or null
 * when it cannot be trusted.
 *
 * GoPro cameras write their local clock time labelled as UTC, so the calendar
 * date is taken as written rather than shifted into a time zone. A stamp before
 * {@link EARLIEST_TRUSTED_YEAR} (an unset clock, the 1904 or 1970 epoch) or
 * more than a day in the future (a wrong clock) is not trusted, and the coach
 * enters the date when reviewing the game (P2-18).
 */
export function recordingDateFrom(
  creationTime: string | null,
  now: Date,
): string | null {
  if (!creationTime) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(creationTime.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) {
    return null;
  }
  if (Number(year) < EARLIEST_TRUSTED_YEAR) return null;
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (date.getTime() > now.getTime() + oneDayMs) return null;
  return `${year}-${month}-${day}`;
}

/**
 * How long ffprobe may take on one file before it is stopped. Reading a header
 * takes seconds even through the Drive mount; a read that never returns must
 * not hold up the whole import pass.
 */
export const PROBE_TIMEOUT_MS = 2 * 60 * 1000;

/** What {@link probeMedia} needs besides the file. */
export interface ProbeOptions {
  /** ffprobe executable; overridden in tests and on hosts with a custom build. */
  readonly ffprobeBinary?: string;
  /** Stop ffprobe after this long; {@link PROBE_TIMEOUT_MS} by default. */
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

/** Run ffprobe on `inputPath` and parse its answer. */
export async function probeMedia(
  inputPath: string,
  {
    ffprobeBinary = "ffprobe",
    timeoutMs = PROBE_TIMEOUT_MS,
    signal,
  }: ProbeOptions = {},
): Promise<MediaProbe> {
  let stdout: string;
  try {
    ({ stdout } = await run(ffprobeBinary, buildProbeArgs(inputPath), {
      signal,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    }));
  } catch (error) {
    if (signal?.aborted) throw error;
    if (isRecord(error) && error.killed === true) {
      throw new ProbeError(
        `ffprobe gave no answer on ${inputPath} within ${Math.round(timeoutMs / 1000)}s`,
      );
    }
    const stderr =
      isRecord(error) && typeof error.stderr === "string" ? error.stderr : "";
    throw new ProbeError(
      `ffprobe failed on ${inputPath}: ${stderr.trim() || String(error)}`,
    );
  }
  return parseProbeOutput(stdout);
}
