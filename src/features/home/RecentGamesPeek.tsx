import Link from "next/link";

import { homeContent } from "./content";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";
import { Icon } from "@/components/core/Icon";
import {
  formatDuration,
  formatPlayedOn,
  gamesContent,
  type GameListItem,
} from "@/features/games";

const { signedIn } = homeContent;
const { list } = gamesContent;

/**
 * A short peek at the coach's most recent games on the landing page: each row
 * links straight into that game's watch view, with a fallback to the full list.
 * Presentational only - the caller picks which (and how many) games to show.
 */
export function RecentGamesPeek({ games }: { games: GameListItem[] }) {
  return (
    <section className="flex flex-col gap-[var(--space-3)]">
      <div className="flex items-center justify-between gap-[var(--space-4)]">
        <h2 className="text-[length:var(--fs-body-sm)] [font-weight:var(--fw-semibold)] tracking-wide text-[color:var(--text-muted)] uppercase">
          {signedIn.recentHeading}
        </h2>
        <Link
          href="/games"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
        >
          {signedIn.recentAll}
        </Link>
      </div>

      {games.length === 0 ? (
        <Card className="p-[var(--space-6)]">
          <EmptyState
            icon="film"
            title={signedIn.recentEmpty.title}
            hint={signedIn.recentEmpty.hint}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-[var(--space-2)]">
          {games.map((game) => (
            <li key={game.id}>
              <Link
                href={`/games/${game.id}/watch`}
                className="block rounded-[var(--radius-lg)]"
              >
                <Card
                  interactive
                  className="flex items-center justify-between gap-[var(--space-4)] p-[var(--space-4)]"
                >
                  <GameSummary game={game} />
                  <Icon
                    name="chevron-right"
                    size={16}
                    className="text-[color:var(--text-muted)]"
                  />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Title plus the opponent/date and chapter roll-up for one recent game. */
function GameSummary({ game }: { game: GameListItem }) {
  const playedOn = formatPlayedOn(game.playedOn);
  const meta = [
    game.opponent ? `vs. ${game.opponent}` : null,
    playedOn,
    game.sourceCount > 0
      ? `${list.sourceCount(game.sourceCount)} · ${formatDuration(game.totalDurationS)}`
      : list.noSources,
  ].filter((part): part is string => part !== null);

  return (
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
  );
}
