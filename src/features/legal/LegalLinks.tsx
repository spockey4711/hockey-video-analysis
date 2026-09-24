import Link from "next/link";

import { legalContent } from "./content";
import { IMPRESSUM_PATH, PRIVACY_PATH } from "./routes";

const { links } = legalContent;

/**
 * The Impressum and Datenschutz links every page must reach. Rendered by the
 * site footer and by the share shell's own footer, so login-free recipients get
 * them too. The two targets are public pages outside the coach app, so they
 * open no route into coach surfaces or another player's clips.
 */
export function LegalLinks() {
  return (
    <nav aria-label={links.navLabel}>
      <ul className="flex flex-wrap items-center gap-x-[var(--space-4)] gap-y-[var(--space-1)]">
        <li>
          <Link
            href={IMPRESSUM_PATH}
            className="underline-offset-2 hover:text-[color:var(--text-primary)] hover:underline"
          >
            {links.impressum}
          </Link>
        </li>
        <li>
          <Link
            href={PRIVACY_PATH}
            className="underline-offset-2 hover:text-[color:var(--text-primary)] hover:underline"
          >
            {links.privacy}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
