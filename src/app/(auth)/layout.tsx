import type { Metadata } from "next";
import type { ReactNode } from "react";

import { accessContent } from "@/features/access";

const { shell } = accessContent;

// Auth screens carry no shareable content; keep them out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Centered, single-column shell for the login and signup screens. Standalone
 * screens sit outside the coach app chrome, so a brand lockup above the card
 * gives them the same identity as the shell's top bar.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[26rem] flex-col justify-center gap-[var(--space-8)] px-[var(--space-6)] py-[var(--space-12)]">
      <div className="flex items-center justify-center gap-[var(--space-3)]">
        <span
          aria-hidden
          className="flex size-[var(--control-lg)] items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] font-[family-name:var(--font-display)] text-[length:var(--fs-h3)] [font-weight:var(--fw-bold)] text-[color:var(--accent-ink)]"
        >
          H
        </span>
        <span className="text-[length:var(--fs-title)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
          {shell.brand}
        </span>
      </div>
      {children}
    </main>
  );
}
