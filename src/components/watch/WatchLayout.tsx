import type { ReactNode } from "react";

export interface WatchLayoutProps {
  /** The page heading region (typically {@link WatchHeader}). */
  readonly header: ReactNode;
  /** The player region, or an empty state when the game has no video. */
  readonly children: ReactNode;
}

/**
 * Outer frame for the watch page (UX-6): a centered, max-width column that
 * stacks the heading over the player region with consistent spacing, and holds
 * the whole layout to a readable width down to a laptop screen. Purely
 * presentational; the responsive player/sidebar split lives inside the player.
 */
export function WatchLayout({ header, children }: WatchLayoutProps) {
  return (
    <main className="mx-auto flex w-full max-w-[var(--content-max)] flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-8)]">
      {header}
      {children}
    </main>
  );
}
