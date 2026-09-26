"use client";

import { usePathname } from "next/navigation";

import { hasOwnChrome } from "./own-chrome-routes";

import { LegalLinks } from "@/features/legal";

/**
 * The site-wide footer carrying the Impressum and Datenschutz links, so every
 * page reaches them - signed in or not, including login and signup. It reads the
 * live {@link usePathname} for the same reason as `CoachHeader`: the root-layout
 * shell does not re-render on client navigation. It stands aside where a route
 * brings its own footer or frame: the share links render the legal links in
 * their own footer, and the immersive workspaces fill the viewport.
 */
export function SiteFooter() {
  const pathname = usePathname();
  if (hasOwnChrome(pathname)) return null;

  return (
    <footer className="mt-auto border-t border-[color:var(--border-subtle)]">
      <div className="mx-auto w-full max-w-[var(--content-max)] px-[var(--space-6)] py-[var(--space-4)] text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
        <LegalLinks />
      </div>
    </footer>
  );
}
