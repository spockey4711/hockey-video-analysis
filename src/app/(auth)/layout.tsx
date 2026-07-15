import type { Metadata } from "next";
import type { ReactNode } from "react";

// Auth screens carry no shareable content; keep them out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Centered, single-column shell for the login and signup screens. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[26rem] flex-col justify-center px-[var(--space-6)] py-[var(--space-12)]">
      {children}
    </main>
  );
}
