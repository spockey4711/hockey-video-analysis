import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";
import { requireCoach } from "@/features/access";
import {
  chapterFileName,
  DiscardGameForm,
  formatDuration,
  gamesContent,
  getGameReview,
  isUnnamedGame,
  ReviewGameForm,
} from "@/features/games";

const { review, list } = gamesContent;

// Coach-only authoring surface; keep it out of search indexes.
export const metadata: Metadata = {
  title: review.title,
  robots: { index: false, follow: false },
};

/**
 * Review one imported game from the "Neu eingegangen" list (P2-18): the coach
 * checks the chapters in play order, sets title, opponent and date, and accepts
 * or discards the game. Coach-only, like the rest of the games workspace; an
 * unknown game id 404s and an already accepted game goes to its watch view.
 */
export default async function ReviewGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCoach(`/games/${id}/review`);

  const game = await getGameReview(id);
  if (!game) {
    notFound();
  }
  if (!isUnnamedGame(game.title)) {
    redirect(`/games/${game.id}/watch`);
  }

  const totalDurationS = game.sources.reduce(
    (sum, source) => sum + source.durationS,
    0,
  );

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
      <Card
        accent
        className="flex flex-col gap-[var(--space-6)] p-[var(--space-8)]"
      >
        <PanelHeader
          level={1}
          size="sub"
          title={review.title}
          hint={review.subtitle}
        />

        <section
          aria-labelledby="review-chapters-heading"
          className="flex flex-col gap-[var(--space-2)]"
        >
          <PanelHeader
            title={review.chaptersHeading}
            titleId="review-chapters-heading"
            action={
              <span className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] tabular-nums">
                {game.sources.length > 0
                  ? review.chaptersTotal(
                      game.sources.length,
                      formatDuration(totalDurationS),
                    )
                  : list.noSources}
              </span>
            }
          />
          {game.sources.length > 0 && (
            <ol className="flex flex-col divide-y divide-[color:var(--border)] rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[var(--surface-inset)]">
              {game.sources.map((source, index) => (
                <li
                  key={source.orderIndex}
                  className="flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)]"
                >
                  <span className="w-[2ch] shrink-0 text-right text-[color:var(--text-muted)] tabular-nums">
                    {index + 1}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-[color:var(--text-primary)]"
                    title={source.filePath}
                  >
                    {chapterFileName(source.filePath)}
                  </span>
                  <span className="shrink-0 text-[color:var(--text-secondary)] tabular-nums">
                    {formatDuration(source.durationS)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <ReviewGameForm gameId={game.id} playedOn={game.playedOn} />

        <div className="border-t border-[color:var(--border)] pt-[var(--space-6)]">
          <DiscardGameForm gameId={game.id} />
        </div>
      </Card>
    </main>
  );
}
