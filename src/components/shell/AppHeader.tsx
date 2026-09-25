import Link from "next/link";

import { PrimaryNav } from "./PrimaryNav";
import { ThemeToggle } from "./ThemeToggle";

import { accessContent, SignOutForm } from "@/features/access";

const { shell } = accessContent;

/**
 * Coach top bar: brand/home link, primary section nav, the signed-in coach and
 * the sign-out control. Rendered only when a coach is present (see AppShell), so
 * it never appears on the login-free share surfaces.
 *
 * Below `lg` the full row does not fit, so the bar wraps: brand and actions share
 * the first row and the nav moves to its own full-width row underneath, with its
 * links wrapping as needed. From `lg` up it is a single row.
 */
export function AppHeader({ coachName }: { coachName: string }) {
  return (
    <header className="border-b border-[color:var(--border)] bg-[var(--surface-raised)]">
      <div className="mx-auto flex w-full max-w-[var(--content-max)] flex-wrap items-center gap-x-[var(--space-6)] gap-y-[var(--space-2)] px-[var(--space-6)] py-[var(--space-3)]">
        <Link
          href="/"
          className="text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] whitespace-nowrap text-[color:var(--text-primary)]"
        >
          {shell.brand}
        </Link>
        <PrimaryNav className="order-last w-full max-lg:-ml-[var(--space-3)] lg:order-none lg:w-auto" />
        <div className="ml-auto flex min-w-0 items-center gap-[var(--space-3)]">
          <span className="hidden min-w-0 truncate text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] sm:block">
            {shell.signedInAs}{" "}
            <span className="text-[color:var(--text-secondary)]">
              {coachName}
            </span>
          </span>
          <ThemeToggle />
          <SignOutForm compact />
        </div>
      </div>
    </header>
  );
}
