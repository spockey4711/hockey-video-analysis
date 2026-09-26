import Link from "next/link";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";
import { buttonClassName } from "@/components/forms/button-styles";
import { notFoundContent } from "@/features/not-found/content";

/**
 * The app-wide not-found page for an unknown route or a `notFound()` call (an
 * unknown game, player or share token), so a dead link lands on the shared
 * page-level `EmptyState` instead of the framework's unstyled fallback.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col px-[var(--space-6)] py-[var(--space-16)]">
      <Card className="px-[var(--space-6)] py-[var(--space-12)]">
        <EmptyState
          icon="search"
          size="lg"
          title={notFoundContent.title}
          hint={notFoundContent.hint}
          action={
            <Link
              href="/"
              className={buttonClassName({ variant: "secondary", size: "md" })}
            >
              {notFoundContent.home}
            </Link>
          }
        />
      </Card>
    </main>
  );
}
