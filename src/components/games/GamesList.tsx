import { GameCard } from "./GameCard";

import { Card } from "@/components/core/Card";
import { gamesContent, type GameListItem } from "@/features/games";

const { list } = gamesContent;

/**
 * The coach's games as a card list, newest first, or a centered empty-state
 * card when there are none yet. Presentational only - the page loads the games
 * and passes them in.
 */
export function GamesList({ games }: { games: GameListItem[] }) {
  if (games.length === 0) {
    return (
      <Card className="p-[var(--space-8)] text-center text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
        {list.empty}
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-[var(--space-3)]">
      {games.map((game) => (
        <li key={game.id}>
          <GameCard game={game} />
        </li>
      ))}
    </ul>
  );
}
