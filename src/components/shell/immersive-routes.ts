/**
 * Routes that render their own full-viewport chrome and must not sit under the
 * global coach top bar ({@link AppHeader}). The watch/tagging workspace is a
 * broadcast HUD with its own left rail, so the shared bar would only steal
 * vertical space and duplicate navigation.
 *
 * Kept as a pure predicate so the shell and its test share one definition and
 * adding an immersive surface is a one-line change.
 */

/** Matches `/games/<id>/watch` (optionally trailing-slashed), and nothing else. */
const IMMERSIVE_PATTERNS: readonly RegExp[] = [/^\/games\/[^/]+\/watch\/?$/];

/** True when `pathname` is an immersive, full-viewport surface. */
export function isImmersiveRoute(pathname: string): boolean {
  return IMMERSIVE_PATTERNS.some((pattern) => pattern.test(pathname));
}
