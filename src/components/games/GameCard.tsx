import Link from "next/link";

import { Card } from "@/components/core/Card";
import { Icon } from "@/components/core/Icon";
import {
  formatDuration,
  formatPlayedOn,
  gamesContent,
  type GameListItem,
} from "@/features/games";

const { list } = gamesContent;

/**
 * One game summary as a clickable card: title and the opponent/date meta on the
 * left, the chapter roll-up on the right, linking into that game's watch view.
 * Presentational only - the list decides which games to render.
 */
export function GameCard({ game }: { game: GameListItem }) {
  const playedOn = formatPlayedOn(game.playedOn);
  const meta = [game.opponent ? `vs. ${game.opponent}` : null, playedOn].filter(
    (part): part is string => part !== null,
  );

  return (
    <Link
      href={`/games/${game.id}/watch`}
      className="block rounded-[var(--radius-lg)]"
    >
      <Card
        interactive
        className="flex items-center gap-[var(--space-4)] p-[var(--space-4)]"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-1)]">
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
        <Icon
          name="chevron-right"
          size={16}
          className="text-[color:var(--text-muted)]"
        />
      </Card>
    </Link>
  );
}
