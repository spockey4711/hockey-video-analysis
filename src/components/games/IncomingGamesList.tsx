import { GameCard } from "./GameCard";

import { gamesContent, type GameListItem } from "@/features/games";

const { incoming } = gamesContent;

/**
 * The "Neu eingegangen" review list (P2-18): imported games waiting for the
 * coach to check the date and chapters, name them and accept or discard them.
 * Renders nothing when no game is waiting, so the games page stays unchanged
 * for a coach who only creates games by hand. Presentational only - the page
 * picks the games still under review and passes them in.
 */
export function IncomingGamesList({ games }: { games: GameListItem[] }) {
  if (games.length === 0) return null;

  return (
    <section
      aria-labelledby="incoming-games-heading"
      className="flex flex-col gap-[var(--space-3)]"
    >
      <div className="flex flex-col gap-[var(--space-1)]">
        <h2
          id="incoming-games-heading"
          className="flex items-center gap-[var(--space-2)] text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-wide)] text-[color:var(--text-secondary)] uppercase"
        >
          {incoming.heading}
          <span className="rounded-[var(--radius-pill)] bg-[var(--accent)] px-[var(--space-2)] py-px text-[color:var(--accent-ink)] tabular-nums">
            {games.length}
          </span>
        </h2>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {incoming.hint}
        </p>
      </div>
      <ul className="flex flex-col gap-[var(--space-3)]">
        {games.map((game) => (
          <li key={game.id}>
            <GameCard game={game} />
          </li>
        ))}
      </ul>
    </section>
  );
}
