import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/core/Card";
import { requireCoach } from "@/features/access";
import { GameForm, gamesContent } from "@/features/games";

const { create, list } = gamesContent;

// Coach-only authoring surface; keep it out of search indexes.
export const metadata: Metadata = {
  title: create.title,
  robots: { index: false, follow: false },
};

/** Create a game and attach its ordered chapter files. */
export default async function NewGamePage() {
  await requireCoach("/games/new");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <div>
        <Link
          href="/games"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] underline-offset-2 hover:underline"
        >
          {list.title}
        </Link>
      </div>
      <Card accent className="p-[var(--space-8)]">
        <header className="mb-[var(--space-6)] flex flex-col gap-[var(--space-2)]">
          <h1 className="text-[length:var(--fs-title)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
            {create.title}
          </h1>
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {create.subtitle}
          </p>
        </header>
        <GameForm />
      </Card>
    </main>
  );
}
