/**
 * Pure builders for a collection's secret share link (P2-13). A collection link
 * resolves by matching `collections.share_token` exactly (see the collection
 * share query), so the path is just that token appended to the collection share
 * route. Kept free of `server-only` and IO so both the coach server surface and
 * the client copy field can share it; the token still only reaches this code
 * server-side.
 */

/** The app-relative path a collection's secret link points at. */
export function collectionSharePath(token: string): string {
  return `/share/collection/${token}`;
}

/**
 * A collection's full share URL when a base URL is known (`NEXT_PUBLIC_APP_URL`),
 * or the app-relative path when it is not - so a coach always has something to
 * copy even if the deploy URL is unset. A trailing slash on the base is trimmed
 * so the result never doubles up.
 */
export function collectionShareUrl(
  token: string,
  baseUrl?: string | null,
): string {
  const path = collectionSharePath(token);
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}
