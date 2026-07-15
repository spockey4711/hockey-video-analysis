/**
 * Pure builders for a player's secret share link (P1-6 UI). The link resolves by
 * matching `players.share_token` exactly (see the per-player share query), so the
 * path is just the token appended to the share route. Kept free of `server-only`
 * and IO so both the server roster and the client share-link field can share it.
 */

/** The app-relative path a player's secret link points at. */
export function playerSharePath(token: string): string {
  return `/share/player/${token}`;
}

/**
 * The player's full share URL when a base URL is known (`NEXT_PUBLIC_APP_URL`),
 * or the app-relative path when it is not - so a coach always has something to
 * copy even if the deploy URL is unset. A trailing slash on the base is trimmed
 * so the result never doubles up.
 */
export function playerShareUrl(token: string, baseUrl?: string | null): string {
  const path = playerSharePath(token);
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}
