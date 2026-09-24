/**
 * Encoding the 720p tagging proxies on the VPS (ADR 0006, ADR 0008).
 *
 * The browser plays a downscaled proxy instead of the multi-GB original; a
 * chapter's proxy lives at the same relative path under the proxy root. This
 * is the one re-encode the VPS runs, so it runs as a background batch: one
 * proxy at a time, at the lowest CPU priority (`nice -n 19`), with a capped
 * thread count.
 *
 * The encoder keeps no queue of its own. The chapter list in `game_sources` is
 * the list of proxies that should exist; each round encodes the first chapter
 * whose proxy file is missing, newest game first. That also backfills proxies
 * for games entered by hand, and a crash or restart loses nothing.
 *
 * A proxy must keep its original's duration, or tags and clip cuts drift
 * between the two renditions (ADR 0006), so each encode is checked with
 * ffprobe before it is moved into place. Until then it is a hidden temporary
 * file next to its final path, so a half-written proxy is never served.
 *
 * The argument builder is pure and unit-tested; the round logic sees the
 * filesystem and ffmpeg through {@link ProxyEncoderDeps}.
 */
import { execFile } from "node:child_process";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { probeMedia } from "./probe";

const run = promisify(execFile);

/** Raised when ffmpeg fails or the proxy's duration does not match. */
export class ProxyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProxyError";
  }
}

/** One chapter that should have a proxy. */
export interface ProxySource {
  /** Path relative to both the source root and the proxy root. */
  readonly filePath: string;
  /** The original's duration from `game_sources`, which the proxy must keep. */
  readonly durationS: number;
}

/** Where the encoder gets its chapter list from. */
export interface ProxySourceList {
  /** Every chapter of every game, newest game first, in play order. */
  listProxySources(): Promise<readonly ProxySource[]>;
}

/** How far a proxy's duration may drift from its original's. */
export const PROXY_DURATION_TOLERANCE_S = 0.5;

/** How many characters of ffmpeg's stderr a failure keeps for the log. */
const STDERR_TAIL_CHARS = 2000;

/**
 * The argument vector encoding one proxy.
 *
 * Only the first video and (if present) audio stream are kept: GoPro files
 * also carry timecode and telemetry tracks a browser cannot use. The height is
 * capped at 720 without upscaling a smaller source, the pixel format is forced
 * to 8-bit 4:2:0 so a 10-bit HEVC original becomes H.264 every browser plays,
 * and `+faststart` moves the index to the front so playback starts before the
 * whole file has loaded. Frame timing is left alone, which keeps the duration.
 */
export function buildProxyArgs(
  inputPath: string,
  outputPath: string,
  threads: number,
): string[] {
  const threadCount = String(threads);
  return [
    "-nostdin",
    "-y",
    "-loglevel",
    "error",
    "-threads",
    threadCount,
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    "scale=-2:'min(720,ih)'",
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "26",
    "-threads",
    threadCount,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
    outputPath,
  ];
}

/**
 * Resolve `relativePath` under `root`, or null when it would escape the root
 * (a hand-entered chapter path such as `../x`). Paths come from the database,
 * so they are checked before any file is read or written.
 */
export function resolveInside(
  root: string,
  relativePath: string,
): string | null {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  return resolved.startsWith(resolvedRoot + path.sep) ? resolved : null;
}

/** The hidden temporary file a proxy is written to before it is checked. */
export function temporaryProxyPath(proxyPath: string): string {
  return path.join(
    path.dirname(proxyPath),
    `.${path.basename(proxyPath)}.partial.mp4`,
  );
}

/** What {@link encodeProxy} needs. */
export interface EncodeProxyOptions {
  readonly sourcePath: string;
  readonly proxyPath: string;
  readonly expectedDurationS: number;
  readonly threads: number;
  readonly signal?: AbortSignal;
  readonly ffmpegBinary?: string;
  readonly ffprobeBinary?: string;
}

/** Encode, check and move one proxy into place. */
export async function encodeProxy({
  sourcePath,
  proxyPath,
  expectedDurationS,
  threads,
  signal,
  ffmpegBinary = "ffmpeg",
  ffprobeBinary = "ffprobe",
}: EncodeProxyOptions): Promise<void> {
  await mkdir(path.dirname(proxyPath), { recursive: true });
  const partial = temporaryProxyPath(proxyPath);
  try {
    try {
      await run(
        "nice",
        [
          "-n",
          "19",
          ffmpegBinary,
          ...buildProxyArgs(sourcePath, partial, threads),
        ],
        { signal, maxBuffer: 16 * 1024 * 1024 },
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      const stderr =
        typeof error === "object" &&
        error !== null &&
        "stderr" in error &&
        typeof error.stderr === "string"
          ? error.stderr
          : String(error);
      throw new ProxyError(
        `ffmpeg failed on ${sourcePath}: ${stderr.trim().slice(-STDERR_TAIL_CHARS)}`,
      );
    }

    const { durationS } = await probeMedia(partial, { ffprobeBinary, signal });
    const drift = Math.abs(durationS - expectedDurationS);
    if (drift > PROXY_DURATION_TOLERANCE_S) {
      throw new ProxyError(
        `proxy of ${sourcePath} lasts ${durationS.toFixed(3)}s, ` +
          `expected ${expectedDurationS.toFixed(3)}s`,
      );
    }
    await rename(partial, proxyPath);
  } finally {
    await rm(partial, { force: true });
  }
}

/** Where the encoder reports what it did; `console` in production. */
export interface ProxyEncoderLog {
  info(message: string): void;
  warn(message: string): void;
}

export interface ProxyEncoderDeps {
  readonly sources: ProxySourceList;
  readonly sourceRoot: string;
  readonly proxyRoot: string;
  readonly exists: (absolutePath: string) => Promise<boolean>;
  readonly encode: (input: {
    sourcePath: string;
    proxyPath: string;
    expectedDurationS: number;
  }) => Promise<void>;
  readonly now: () => Date;
  readonly log: ProxyEncoderLog;
  /** How long a chapter whose encode failed is left alone before a retry. */
  readonly retryMs: number;
}

/**
 * Create an encoder whose rounds share the failure memory. `encodeNext`
 * encodes at most one proxy and resolves whether it did any work, so the
 * caller sleeps only when every proxy that can be made exists.
 */
export function createProxyEncoder(deps: ProxyEncoderDeps): {
  encodeNext(): Promise<boolean>;
} {
  const failedUntil = new Map<string, number>();
  const reported = new Set<string>();

  function reportOnce(filePath: string, message: string): void {
    if (reported.has(filePath)) return;
    reported.add(filePath);
    deps.log.warn(message);
  }

  async function encodeNext(): Promise<boolean> {
    const sources = await deps.sources.listProxySources();
    const now = deps.now().getTime();

    for (const source of sources) {
      const proxyPath = resolveInside(deps.proxyRoot, source.filePath);
      const sourcePath = resolveInside(deps.sourceRoot, source.filePath);
      if (!proxyPath || !sourcePath) {
        reportOnce(
          source.filePath,
          `no proxy for "${source.filePath}": the path leaves the media root`,
        );
        continue;
      }
      if (await deps.exists(proxyPath)) continue;
      if ((failedUntil.get(source.filePath) ?? 0) > now) continue;
      if (!(await deps.exists(sourcePath))) {
        reportOnce(
          source.filePath,
          `no proxy for "${source.filePath}": not found under the source root`,
        );
        continue;
      }

      const startedAt = deps.now().getTime();
      deps.log.info(`encoding proxy for "${source.filePath}"`);
      try {
        await deps.encode({
          sourcePath,
          proxyPath,
          expectedDurationS: source.durationS,
        });
      } catch (error) {
        // A shutdown is not a failure of this chapter.
        if (error instanceof Error && error.name === "AbortError") throw error;
        // Any other failure - ffmpeg, the duration check, Drive dropping out - parks
        // this chapter for a while so the next round moves on to the others.
        failedUntil.set(source.filePath, deps.now().getTime() + deps.retryMs);
        deps.log.warn(
          `proxy for "${source.filePath}" failed, retrying in ` +
            `${Math.round(deps.retryMs / 60000)} min: ${String(error)}`,
        );
        return true;
      }
      failedUntil.delete(source.filePath);
      reported.delete(source.filePath);
      const minutes = (deps.now().getTime() - startedAt) / 60000;
      deps.log.info(
        `proxy for "${source.filePath}" ready after ${minutes.toFixed(1)} min`,
      );
      return true;
    }
    return false;
  }

  return { encodeNext };
}
