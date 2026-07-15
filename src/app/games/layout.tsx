import Link from "next/link";
import type { ReactNode } from "react";

import { accessContent, getCurrentCoach, SignOutForm } from "@/features/access";

const { shell } = accessContent;

/**
 * Coach app shell wrapping every authenticated `/games` surface. Renders a top
 * bar with the brand, the signed-in coach and the sign-out control; the pages
 * below run their own `requireCoach()` guard. When there is no session the guard
 * redirects, so the bar is only drawn once a coach is present.
 */
export default async function GamesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const coach = await getCurrentCoach();

  return (
    <div className="flex min-h-screen flex-col">
      {coach && (
        <header className="border-b border-[color:var(--border)] bg-[var(--surface-raised)]">
          <div className="mx-auto flex w-full max-w-[var(--content-max)] items-center justify-between gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-3)]">
            <Link
              href="/games"
              className="text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]"
            >
              {shell.brand}
            </Link>
            <div className="flex items-center gap-[var(--space-3)]">
              <span className="hidden text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] sm:inline">
                {shell.signedInAs}{" "}
                <span className="text-[color:var(--text-secondary)]">
                  {coach.name}
                </span>
              </span>
              <SignOutForm />
            </div>
          </div>
        </header>
      )}
      {children}
    </div>
  );
}
