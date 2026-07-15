import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/core/Card";
import { Button } from "@/components/forms/Button";
import { requireCoach } from "@/features/access";
import {
  formatDuration,
  formatPlayedOn,
  gamesContent,
  listGames,
  type GameListItem,
} from "@/features/games";

const { list } = gamesContent;

// Coach-only workspace; keep it out of search indexes.
export const metadata: Metadata = {
  title: list.title,
  robots: { index: false, follow: false },
};

/** The coach's games, newest first, with a link to create the next one. */
export default async function GamesPage() {
  await requireCoach("/games");
  const games = await listGames();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <header className="flex items-start justify-between gap-[var(--space-4)]">
        <div className="flex flex-col gap-[var(--space-1)]">
          <h1 className="text-[length:var(--fs-heading)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
            {list.title}
          </h1>
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {list.subtitle}
          </p>
        </div>
        <Link href="/games/new">
          <Button iconLeft="fast-forward">{list.newGame}</Button>
        </Link>
      </header>

      {games.length === 0 ? (
        <Card className="p-[var(--space-8)] text-center text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {list.empty}
        </Card>
      ) : (
        <ul className="flex flex-col gap-[var(--space-3)]">
          {games.map((game) => (
            <li key={game.id}>
              <GameRow game={game} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** One game summary row: title, opponent, date and the chapter roll-up. */
function GameRow({ game }: { game: GameListItem }) {
  const playedOn = formatPlayedOn(game.playedOn);
  const meta = [game.opponent ? `vs. ${game.opponent}` : null, playedOn].filter(
    (part): part is string => part !== null,
  );

  return (
    <Card className="flex items-center justify-between gap-[var(--space-4)] p-[var(--space-4)]">
      <div className="flex min-w-0 flex-col gap-[var(--space-1)]">
        <span className="truncate text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
          {game.title}
        </span>
        {meta.length > 0 && (
          <span className="truncate text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {meta.join(" · ")}
          </span>
        )}
      </div>
      <div className="shrink-0 text-right text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
        <span className="tabular-nums">
          {game.sourceCount > 0
            ? list.sourceCount(game.sourceCount)
            : list.noSources}
        </span>
        {game.sourceCount > 0 && (
          <span className="text-[color:var(--text-muted)]">
            {" · "}
            <span className="tabular-nums">
              {formatDuration(game.totalDurationS)}
            </span>
          </span>
        )}
      </div>
    </Card>
  );
}
