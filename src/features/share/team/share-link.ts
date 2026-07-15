/**
 * Pure builders for the team's secret share link (P2-4 UI). The team link
 * resolves by matching the URL token against the server-only `TEAM_SHARE_TOKEN`
 * (see {@link ./token}), so the path is just that token appended to the team
 * share route. Kept free of `server-only` and IO so both the server surface and
 * the client copy field can share it; the token still only reaches this code
 * server-side.
 */

/** The app-relative path the team's secret link points at. */
export function teamSharePath(token: string): string {
  return `/share/team/${token}`;
}

/**
 * The team's full share URL when a base URL is known (`NEXT_PUBLIC_APP_URL`), or
 * the app-relative path when it is not - so the coach always has something to
 * copy even if the deploy URL is unset. A trailing slash on the base is trimmed
 * so the result never doubles up.
 */
export function teamShareUrl(token: string, baseUrl?: string | null): string {
  const path = teamSharePath(token);
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}
