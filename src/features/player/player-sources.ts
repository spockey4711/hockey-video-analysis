/**
 * Turns the ordered chapter rows of a game (`game_sources`) into the playable
 * source list the continuous player consumes.
 *
 * The player reasons purely in global game time (ADR 0002); each source only
 * needs a URL to load and its duration to place it on that timeline. The NAS
 * `file_path` stored in the database is not itself a URL, so it is resolved
 * against a configurable media base URL here, on the server, before anything
 * reaches the client - the raw NAS layout never ships to the browser.
 */

/** One chapter as stored: its NAS file path and duration in seconds. */
export interface ChapterInput {
  readonly filePath: string;
  readonly durationS: number;
}

/** One chapter as the player needs it: a loadable URL and its duration. */
export interface PlayerSource {
  readonly src: string;
  readonly durationS: number;
}

/**
 * Where a game's chapter files are served from. `baseUrl` is the full-resolution
 * media root; the optional `proxyBaseUrl` is a parallel root of downscaled
 * renditions (ADR 0006). Both are server-only env values resolved on the server
 * before any URL reaches the browser.
 */
export interface MediaRoots {
  readonly baseUrl: string | undefined;
  readonly proxyBaseUrl?: string | undefined;
}

/**
 * Resolve a stored NAS `filePath` into a URL the `<video>` element can load.
 *
 * When `baseUrl` is set, the file path is appended to it as URL-encoded path
 * segments (so spaces and unicode in file names stay valid). When it is unset,
 * the path is returned unchanged, which lets a local dev setup serve chapter
 * files straight from `public/` without configuring a base URL.
 */
export function resolveSourceUrl(
  filePath: string,
  baseUrl: string | undefined,
): string {
  const path = filePath.trim();
  const base = baseUrl?.trim();
  if (!base) return path;

  const encodedPath = path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base.replace(/\/+$/, "")}/${encodedPath}`;
}

/**
 * Map the ordered chapter list of a game to the player's source list. Order is
 * preserved: index `i` is chapter `i`, which is exactly the coordinate the
 * game-time mapping expects.
 *
 * Each chapter's URL prefers the proxy root when one is configured, so the
 * browser plays a lighter downscaled rendition for tagging (ADR 0006, P2-6) and
 * full-resolution stays server-side for the pipeline's clip cutting. A proxy
 * mirrors the chapter's relative path under `proxyBaseUrl` and keeps the same
 * duration, so `durationS` is copied through unchanged and the global game-time
 * mapping is untouched. When no proxy root is set, this falls back to the
 * full-resolution `baseUrl`.
 */
export function toPlayerSources(
  chapters: readonly ChapterInput[],
  { baseUrl, proxyBaseUrl }: MediaRoots,
): PlayerSource[] {
  const playbackBase = proxyBaseUrl?.trim() ? proxyBaseUrl : baseUrl;
  return chapters.map((chapter) => ({
    src: resolveSourceUrl(chapter.filePath, playbackBase),
    durationS: chapter.durationS,
  }));
}
