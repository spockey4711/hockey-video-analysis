import { notFound } from "next/navigation";

import { requireCoach } from "@/features/access";
import {
  ContinuousPlayer,
  playerContent,
  toPlayerSources,
} from "@/features/player";
import { loadWatchGame } from "@/features/player/queries";
import { TaggingPanel } from "@/features/tagging";

/** Format an ISO date (`YYYY-MM-DD`) for the German-speaking coach audience. */
function formatPlayedOn(playedOn: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${playedOn}T00:00:00Z`));
}

/**
 * Watch a game as one continuous, multi-chapter timeline (PRD 5.2). Coach-only:
 * the player is where tagging happens. This is the shared shell - sibling lanes
 * add hotkey tagging (P0-6) and the quarter overlay (P1-4) via the player's
 * typed slots rather than editing this page.
 */
export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCoach(`/games/${id}/watch`);

  const game = await loadWatchGame(id);
  if (!game) notFound();

  const sources = toPlayerSources(game.chapters, process.env.MEDIA_BASE_URL);

  return (
    <main className="mx-auto flex w-full max-w-[var(--content-max)] flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-8)]">
      <header className="flex flex-col gap-[var(--space-2)]">
        <h1 className="text-[length:var(--fs-h2)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
          {game.title}
        </h1>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {game.opponent
            ? `${playerContent.header.opponentPrefix} ${game.opponent}`
            : null}
          {game.opponent && game.playedOn ? " · " : null}
          {game.playedOn ? formatPlayedOn(game.playedOn) : null}
        </p>
      </header>

      {sources.length > 0 ? (
        <ContinuousPlayer
          sources={sources}
          title={game.title}
          sidebar={<TaggingPanel gameId={game.id} />}
        />
      ) : (
        <p className="rounded-[var(--radius-lg)] bg-[var(--surface-inset)] p-[var(--space-6)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {playerContent.status.empty}
        </p>
      )}
    </main>
  );
}
