/**
 * Routes that bring their own chrome and must render without the global coach
 * shell: neither the coach top bar ({@link AppHeader}) nor the site-wide footer.
 *
 * - Immersive workspaces: the watch/tagging workspace is a broadcast HUD with
 *   its own left rail, and the clip editor a full-window workspace with its own
 *   header, so the shared bar would only steal vertical space and duplicate
 *   navigation.
 * - Share links: the login-free `ShareShell` has its own branded bar and a
 *   footer carrying the legal links. A signed-in coach who opens a link to check
 *   it must see exactly what the player sees, and the surface stays nav-free.
 *
 * Kept as one pure predicate so the header gate, the footer gate and their test
 * share a single definition, and adding such a surface is a one-line change.
 */

/**
 * Matches `/games/<id>/watch`, the clip editor `/collections/<id>/editor` (each
 * optionally trailing-slashed), and every route under `/share`.
 */
const OWN_CHROME_PATTERNS: readonly RegExp[] = [
  /^\/games\/[^/]+\/watch\/?$/,
  /^\/collections\/[^/]+\/editor\/?$/,
  /^\/share(\/|$)/,
];

/** True when `pathname` renders its own chrome instead of the coach shell's. */
export function hasOwnChrome(pathname: string): boolean {
  return OWN_CHROME_PATTERNS.some((pattern) => pattern.test(pathname));
}
