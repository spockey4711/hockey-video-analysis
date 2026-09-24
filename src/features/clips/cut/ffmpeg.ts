/**
 * Cutting a {@link ClipCutPlan} into one playable file with `ffmpeg -c copy`.
 *
 * Copy-cutting never re-encodes (ADR 0004): it is I/O-bound, so it is the one
 * video operation the always-on VPS is allowed to do (ADR 0003). The price is
 * keyframe tolerance - a boundary lands within a couple of seconds of the
 * requested offset - which the tag windows are padded for.
 *
 * A window that stays inside one chapter is a single `-ss/-t` copy. A window
 * that crosses a chapter seam (P1-7) is cut per chapter and the pieces are
 * joined with the concat demuxer, again without re-encoding.
 *
 * The argument builders are pure so the exact command line is unit-tested; only
 * {@link cutClip} touches the filesystem and spawns a process.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { ClipCutPlan, ClipSourceCut } from "@/features/clips/boundary";

const run = promisify(execFile);

/** Raised when ffmpeg exits non-zero, carrying the tail of its diagnostics. */
export class ClipCutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClipCutError";
  }
}

/** How many characters of ffmpeg's stderr a failure keeps for the log. */
const STDERR_TAIL_CHARS = 2000;

/** Render a second offset the way ffmpeg's `-ss`/`-t` arguments expect it. */
export function formatOffset(seconds: number): string {
  return seconds.toFixed(3);
}

/**
 * The argument vector copying one chapter cut into `outputPath`.
 *
 * `-ss` sits before `-i` for a fast keyframe seek; `-avoid_negative_ts
 * make_zero` rebases the timestamps so the piece starts at zero, which both a
 * player and the concat demuxer need. `-nostdin` keeps ffmpeg from consuming
 * the worker's stdin, `-y` overwrites a stale partial output from a retry.
 */
export function buildCutArgs(
  inputPath: string,
  cut: Pick<ClipSourceCut, "localStartS" | "durationS">,
  outputPath: string,
): string[] {
  return [
    "-nostdin",
    "-y",
    "-loglevel",
    "error",
    "-ss",
    formatOffset(cut.localStartS),
    "-i",
    inputPath,
    "-t",
    formatOffset(cut.durationS),
    "-c",
    "copy",
    "-avoid_negative_ts",
    "make_zero",
    outputPath,
  ];
}

/**
 * The concat demuxer's input list: one `file '<path>'` line per piece, in play
 * order. Single quotes in a path are escaped the way the demuxer expects
 * (`'\''`), so a quote in a file name cannot break the list apart.
 */
export function buildConcatList(pieces: readonly string[]): string {
  return pieces
    .map((piece) => `file '${piece.replaceAll("'", "'\\''")}'\n`)
    .join("");
}

/**
 * The argument vector joining the listed pieces into `outputPath`.
 *
 * `-safe 0` allows absolute paths in the list; the list is written by this
 * module from planned chapter paths, never by a request.
 */
export function buildConcatArgs(
  listPath: string,
  outputPath: string,
): string[] {
  return [
    "-nostdin",
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ];
}

/** What {@link cutClip} needs besides the plan itself. */
export interface CutClipOptions {
  /**
   * Directory the plan's relative chapter paths resolve against: the read-only
   * source root (the Drive mount, ADR 0008), not where clips are written.
   */
  readonly sourceRoot: string;
  /** Absolute path of the file to write. */
  readonly outputPath: string;
  /** ffmpeg executable; overridden in tests and on hosts with a custom build. */
  readonly ffmpegBinary?: string;
}

async function runFfmpeg(binary: string, args: string[]): Promise<void> {
  try {
    await run(binary, args, { maxBuffer: 8 * 1024 * 1024 });
  } catch (cause) {
    const stderr =
      typeof cause === "object" && cause !== null && "stderr" in cause
        ? String((cause as { stderr: unknown }).stderr)
        : "";
    throw new ClipCutError(
      `ffmpeg failed: ${stderr.slice(-STDERR_TAIL_CHARS).trim() || String(cause)}`,
    );
  }
}

/**
 * Cut `plan` into `outputPath`, creating its directory if needed.
 *
 * Multi-chapter plans stage their pieces in a temporary directory that is
 * removed again whether or not the cut succeeded.
 *
 * @throws ClipCutError if ffmpeg fails.
 */
export async function cutClip(
  plan: ClipCutPlan,
  { sourceRoot, outputPath, ffmpegBinary = "ffmpeg" }: CutClipOptions,
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const inputFor = (cut: ClipSourceCut) =>
    path.resolve(sourceRoot, cut.filePath);

  if (plan.cuts.length === 1) {
    const [cut] = plan.cuts;
    await runFfmpeg(ffmpegBinary, buildCutArgs(inputFor(cut), cut, outputPath));
    return;
  }

  const stagingDir = await mkdtemp(path.join(tmpdir(), "clip-cut-"));
  try {
    const pieces: string[] = [];
    for (const [index, cut] of plan.cuts.entries()) {
      const piecePath = path.join(stagingDir, `part-${index}.mp4`);
      await runFfmpeg(
        ffmpegBinary,
        buildCutArgs(inputFor(cut), cut, piecePath),
      );
      pieces.push(piecePath);
    }
    const listPath = path.join(stagingDir, "parts.txt");
    await writeFile(listPath, buildConcatList(pieces), "utf8");
    await runFfmpeg(ffmpegBinary, buildConcatArgs(listPath, outputPath));
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }
}
