import { GameCard } from "./GameCard";

import { PanelHeader } from "@/components/core/PanelHeader";
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
      <PanelHeader
        titleId="incoming-games-heading"
        title={
          <span className="flex items-center gap-[var(--space-2)]">
            {incoming.heading}
            <span className="rounded-[var(--radius-pill)] bg-[var(--accent)] px-[var(--space-2)] py-px text-[color:var(--accent-ink)] tabular-nums">
              {games.length}
            </span>
          </span>
        }
        hint={incoming.hint}
      />
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
