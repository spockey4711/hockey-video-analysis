import Link from "next/link";

import { PrimaryNav } from "./PrimaryNav";
import { ThemeToggle } from "./ThemeToggle";

import { accessContent, SignOutForm } from "@/features/access";

const { shell } = accessContent;

/**
 * Coach top bar: brand/home link, primary section nav, the signed-in coach and
 * the sign-out control. Rendered only when a coach is present (see AppShell), so
 * it never appears on the login-free share surfaces.
 */
export function AppHeader({ coachName }: { coachName: string }) {
  return (
    <header className="border-b border-[color:var(--border)] bg-[var(--surface-raised)]">
      <div className="mx-auto flex w-full max-w-[var(--content-max)] items-center gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-3)]">
        <Link
          href="/"
          className="text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]"
        >
          {shell.brand}
        </Link>
        <PrimaryNav />
        <div className="ml-auto flex items-center gap-[var(--space-3)]">
          <span className="hidden text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] sm:inline">
            {shell.signedInAs}{" "}
            <span className="text-[color:var(--text-secondary)]">
              {coachName}
            </span>
          </span>
          <ThemeToggle />
          <SignOutForm />
        </div>
      </div>
    </header>
  );
}
