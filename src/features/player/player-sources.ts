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
 * Map the ordered chapter list of a game to the player's source list, resolving
 * each NAS path against `baseUrl`. Order is preserved: index `i` is chapter `i`,
 * which is exactly the coordinate the game-time mapping expects.
 */
export function toPlayerSources(
  chapters: readonly ChapterInput[],
  baseUrl: string | undefined,
): PlayerSource[] {
  return chapters.map((chapter) => ({
    src: resolveSourceUrl(chapter.filePath, baseUrl),
    durationS: chapter.durationS,
  }));
}
