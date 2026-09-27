import Link from "next/link";

import { RailNav } from "./RailNav";
import { watchContent } from "./content";

import { cn } from "@/components/core/cn";
import {
  playerAvatarClass,
  playerInitials,
} from "@/components/data/player-identity";

export interface WatchRailProps {
  /** The game being tagged; drives the contextual Tagging nav target. */
  readonly gameId: string;
  /** The signed-in coach, shown as an initials avatar at the foot of the rail. */
  readonly coachName: string;
}

/**
 * The workspace's left icon rail: a home monogram, the game-contextual section
 * nav ({@link RailNav}), and the signed-in coach's avatar pinned to the bottom.
 * Replaces the shared top bar on this immersive route (see AppShell). Narrow by
 * design (`--rail-w`); labels sit under each glyph in the HUD micro size. Below
 * the `lg` breakpoint the workspace stacks (see PlayerWorkspace) and the rail
 * lies down into a strip across the top, the avatar pinned to its right end.
 */
export function WatchRail({ gameId, coachName }: WatchRailProps) {
  const { rail } = watchContent;

  return (
    <div className="flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-1)] lg:h-full lg:flex-col lg:gap-[var(--space-4)] lg:px-0 lg:py-[var(--space-3)]">
      <Link
        href="/"
        aria-label={rail.home}
        // eslint-disable-next-line no-restricted-syntax -- the "H" brand mark, not a heading.
        className="flex size-[var(--control-md)] items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] font-[family-name:var(--font-display)] text-[length:var(--fs-title)] [font-weight:var(--fw-bold)] text-[color:var(--accent-ink)]"
      >
        H
      </Link>

      <RailNav gameId={gameId} />

      <span
        aria-label={rail.coach(coachName)}
        title={coachName}
        className={cn(
          // eslint-disable-next-line no-restricted-syntax -- the coach avatar initials take the display face; not a heading.
          "ms-auto inline-flex size-[var(--control-md)] items-center justify-center rounded-[var(--radius-pill)] [font-family:var(--font-display)] text-[length:var(--fs-body-sm)] leading-none [font-weight:var(--fw-semibold)] lg:ms-0 lg:mt-auto",
          playerAvatarClass(coachName),
        )}
      >
        {playerInitials(coachName)}
      </span>
    </div>
  );
}
