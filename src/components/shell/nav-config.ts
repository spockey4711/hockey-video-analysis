/**
 * Primary navigation for the coach app shell, kept as data so the top bar and
 * its tests share one source of truth and adding a section is a one-line change.
 * German labels match the app's coach audience (see the access content layer).
 */
export interface NavItem {
  /** Section root the link points at. */
  href: string;
  /** Visible label. */
  label: string;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/games", label: "Spiele" },
  { href: "/players", label: "Kader" },
] as const;

/**
 * True when `pathname` sits inside `href`'s section: an exact match or a
 * descendant route (`/games/42/watch`), but not a sibling that merely shares the
 * prefix (`/games-archive`).
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
