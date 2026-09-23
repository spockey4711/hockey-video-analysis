/**
 * Which workspace-rail item is the current page. The rail nests its items
 * (`/games` contains `/games/<id>/watch` and `/games/<id>/report`), so a plain
 * prefix match would mark the games list and the tagging item at once; the
 * rail marks only the most specific section that contains the pathname.
 */
import { isNavItemActive } from "@/components/shell/nav-config";

/** The href of the longest item containing `pathname`, or `null` for none. */
export function activeRailHref(
  hrefs: readonly string[],
  pathname: string,
): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (!isNavItemActive(href, pathname)) continue;
    if (best === null || href.length > best.length) best = href;
  }
  return best;
}
