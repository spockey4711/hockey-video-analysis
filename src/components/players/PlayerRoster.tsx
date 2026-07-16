import { PlayerRow } from "./PlayerRow";

import { Card } from "@/components/core/Card";
import {
  rosterContent,
  type PlayerRosterItem,
} from "@/features/players/roster";

/**
 * The roster as a list of player cards, or a centered empty-state card when
 * there are none yet. Presentational only - the page loads the players and
 * passes them in, along with the app base URL for absolute share links.
 */
export function PlayerRoster({
  players,
  baseUrl,
}: {
  players: PlayerRosterItem[];
  baseUrl?: string;
}) {
  if (players.length === 0) {
    return (
      <Card className="p-[var(--space-8)] text-center text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
        {rosterContent.empty}
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-[var(--space-3)]">
      {players.map((player) => (
        <li key={player.id}>
          <PlayerRow player={player} baseUrl={baseUrl} />
        </li>
      ))}
    </ul>
  );
}
