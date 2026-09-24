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
 * for games entered by hand, and a crash or restart loses nothing: a proxy is
 * either in place or encoded again.
 *
 * A game the importer registers stays hidden from the coach until every one of
 * its chapters has a proxy; each round first shows the hidden games whose
 * proxies are all there. A chapter whose encode fails is retried with a growing
 * wait and a logged reason each time, and its game stays hidden meanwhile, so
 * the coach never sees a game with a chapter that does not play.
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
  readonly gameId: string;
  /** The game is hidden from the coach until all its chapters have proxies. */
  readonly awaitingProxies: boolean;
  /** Path relative to both the source root and the proxy root. */
  readonly filePath: string;
  /** The original's duration from `game_sources`, which the proxy must keep. */
  readonly durationS: number;
}

/** Where the encoder gets its chapter list from. */
export interface ProxySourceList {
  /** Every chapter of every game, newest game first, in play order. */
  listProxySources(): Promise<readonly ProxySource[]>;
  /**
   * Show a hidden game to the coach, but only while it has exactly
   * `chapterCount` chapters: a late part appended meanwhile has no proxy yet.
   * Resolves whether the game is shown now.
   */
  markProxiesReady(gameId: string, chapterCount: number): Promise<boolean>;
}

/** How far a proxy's duration may drift from its original's. */
export const PROXY_DURATION_TOLERANCE_S = 0.5;

/** How many characters of ffmpeg's stderr a failure keeps for the log. */
const STDERR_TAIL_CHARS = 2000;

const MINUTE_MS = 60 * 1000;

/**
 * How long one proxy encode may run before it is stopped: half an hour plus
 * six times the chapter's length, far beyond a normal encode, so only a hung
 * ffmpeg (a Drive read that never returns) hits it.
 */
export function proxyTimeoutMs(durationS: number): number {
  return 30 * MINUTE_MS + Math.ceil(durationS * 6 * 1000);
}

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
  /** Stop ffmpeg after this long; see {@link proxyTimeoutMs}. */
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly ffmpegBinary?: string;
  readonly ffprobeBinary?: string;
}

/** Why ffmpeg failed, from the error `execFile` rejects with. */
function describeFfmpegFailure(error: unknown, timeoutMs: number): string {
  const fields =
    typeof error === "object" && error !== null
      ? (error as { killed?: unknown; signal?: unknown; stderr?: unknown })
      : {};
  if (fields.killed === true) {
    return `stopped after ${Math.round(timeoutMs / MINUTE_MS)} min`;
  }
  const stderr =
    typeof fields.stderr === "string"
      ? fields.stderr.trim().slice(-STDERR_TAIL_CHARS)
      : "";
  if (typeof fields.signal === "string") {
    return `killed by ${fields.signal}${stderr ? `: ${stderr}` : ""}`;
  }
  return stderr || String(error);
}

/** Encode, check and move one proxy into place. */
export async function encodeProxy({
  sourcePath,
  proxyPath,
  expectedDurationS,
  threads,
  timeoutMs = proxyTimeoutMs(expectedDurationS),
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
        { signal, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ProxyError(
        `ffmpeg failed on ${sourcePath}: ${describeFfmpegFailure(error, timeoutMs)}`,
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
  /** First wait before retrying a chapter whose encode failed; doubles per failure. */
  readonly retryMs: number;
}

/** The longest wait between two encode attempts on the same chapter. */
const MAX_PROXY_RETRY_MS = 24 * 60 * MINUTE_MS;

/**
 * Create an encoder whose rounds share the failure memory. `encodeNext`
 * encodes at most one proxy and resolves whether it did any work, so the
 * caller sleeps only when every proxy that can be made exists.
 */
export function createProxyEncoder(deps: ProxyEncoderDeps): {
  encodeNext(): Promise<boolean>;
} {
  const failures = new Map<string, { count: number; retryAt: number }>();
  const reported = new Set<string>();

  function reportOnce(filePath: string, message: string): void {
    if (reported.has(filePath)) return;
    reported.add(filePath);
    deps.log.warn(message);
  }

  /** A chapter's absolute paths, or null (reported) when it leaves a root. */
  function pathsOf(source: ProxySource) {
    const proxyPath = resolveInside(deps.proxyRoot, source.filePath);
    const sourcePath = resolveInside(deps.sourceRoot, source.filePath);
    if (proxyPath && sourcePath) return { proxyPath, sourcePath };
    reportOnce(
      source.filePath,
      `no proxy for "${source.filePath}": the path leaves the media root`,
    );
    return null;
  }

  /** Show every hidden game whose chapters all have their proxies. */
  async function showReadyGames(
    sources: readonly ProxySource[],
    missing: ReadonlySet<ProxySource>,
  ): Promise<void> {
    const chapters = new Map<string, ProxySource[]>();
    for (const source of sources) {
      if (!source.awaitingProxies) continue;
      const list = chapters.get(source.gameId) ?? [];
      list.push(source);
      chapters.set(source.gameId, list);
    }
    for (const [gameId, list] of chapters) {
      if (list.some((source) => missing.has(source))) continue;
      if (await deps.sources.markProxiesReady(gameId, list.length)) {
        deps.log.info(
          `game ${gameId} has all ${list.length} proxies and is shown now`,
        );
      }
    }
  }

  async function encodeNext(): Promise<boolean> {
    const sources = await deps.sources.listProxySources();

    const missing = new Set<ProxySource>();
    for (const source of sources) {
      const paths = pathsOf(source);
      if (!paths || !(await deps.exists(paths.proxyPath))) missing.add(source);
    }
    await showReadyGames(sources, missing);

    const now = deps.now().getTime();
    for (const source of missing) {
      const paths = pathsOf(source);
      if (!paths) continue;
      const failure = failures.get(source.filePath);
      if (failure && failure.retryAt > now) continue;
      if (!(await deps.exists(paths.sourcePath))) {
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
          ...paths,
          expectedDurationS: source.durationS,
        });
      } catch (error) {
        // A shutdown is not a failure of this chapter.
        if (error instanceof Error && error.name === "AbortError") throw error;
        // Any other failure - ffmpeg, the duration check, Drive dropping out -
        // parks this chapter for a growing while so the next round moves on to
        // the others; its game stays hidden until the proxy is made.
        const count = (failure?.count ?? 0) + 1;
        const waitMs = Math.min(
          deps.retryMs * 2 ** (count - 1),
          MAX_PROXY_RETRY_MS,
        );
        failures.set(source.filePath, {
          count,
          retryAt: deps.now().getTime() + waitMs,
        });
        deps.log.warn(
          `proxy for "${source.filePath}" failed (attempt ${count}, retrying ` +
            `in ${Math.round(waitMs / MINUTE_MS)} min): ${String(error)}`,
        );
        return true;
      }
      failures.delete(source.filePath);
      reported.delete(source.filePath);
      const minutes = (deps.now().getTime() - startedAt) / MINUTE_MS;
      deps.log.info(
        `proxy for "${source.filePath}" ready after ${minutes.toFixed(1)} min`,
      );
      return true;
    }
    return false;
  }

  return { encodeNext };
}
