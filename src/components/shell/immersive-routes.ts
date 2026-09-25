/**
 * Routes that render their own full-viewport chrome and must not sit under the
 * global coach top bar ({@link AppHeader}). The watch/tagging workspace is a
 * broadcast HUD with its own left rail, and the clip editor a full-window
 * workspace with its own header, so the shared bar would only steal vertical
 * space and duplicate navigation.
 *
 * Kept as a pure predicate so the shell and its test share one definition and
 * adding an immersive surface is a one-line change.
 */

/**
 * Matches `/games/<id>/watch` and the clip editor `/collections/<id>/editor`
 * (each optionally trailing-slashed), and nothing else.
 */
const IMMERSIVE_PATTERNS: readonly RegExp[] = [
  /^\/games\/[^/]+\/watch\/?$/,
  /^\/collections\/[^/]+\/editor\/?$/,
];

/** True when `pathname` is an immersive, full-viewport surface. */
export function isImmersiveRoute(pathname: string): boolean {
  return IMMERSIVE_PATTERNS.some((pattern) => pattern.test(pathname));
}

/** Matches the login-free share links, whose `ShareShell` has its own footer. */
const SHARE_PATTERN = /^\/share(\/|$)/;

/**
 * True when the route brings its own footer or full-viewport frame, so the
 * site-wide footer must not render: the immersive HUD and the share links
 * (whose own footer carries the legal links).
 */
export function hasOwnFooter(pathname: string): boolean {
  return isImmersiveRoute(pathname) || SHARE_PATTERN.test(pathname);
}
