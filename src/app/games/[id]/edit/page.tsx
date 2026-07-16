import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/core/Card";
import { requireCoach } from "@/features/access";
import {
  formatPlayedOn,
  gamesContent,
  getGameNaming,
  isUnnamedGame,
  RenameGameForm,
} from "@/features/games";

const { rename, list } = gamesContent;

// Coach-only authoring surface; keep it out of search indexes.
export const metadata: Metadata = {
  title: rename.title,
  robots: { index: false, follow: false },
};

/**
 * Name (or rename) a game. This is where a coach titles a game that arrived via
 * the drop-a-folder ingest (P2-9) in a needs-a-name state, and where any title
 * can be corrected. Coach-only, like the rest of the games workspace; an unknown
 * game id 404s.
 */
export default async function EditGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCoach(`/games/${id}/edit`);

  const game = await getGameNaming(id);
  if (!game) {
    notFound();
  }

  const recordedOn = formatPlayedOn(game.playedOn);

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
            {rename.title}
          </h1>
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {rename.subtitle}
          </p>
          {recordedOn && (
            <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
              {rename.recordedOn(recordedOn)}
            </p>
          )}
        </header>
        <RenameGameForm
          gameId={game.id}
          currentTitle={isUnnamedGame(game.title) ? "" : game.title}
        />
      </Card>
    </main>
  );
}
