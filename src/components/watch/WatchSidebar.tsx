import type { ReactNode } from "react";

export interface WatchSidebarProps {
  /** Rail panels (tagging, quarter editor, hotkey hints), stacked in order. */
  readonly children: ReactNode;
}

/**
 * The beside-player rail (UX-6): stacks the tagging, quarter and hotkey panels
 * with a consistent gap so the watch page composes them without repeating the
 * spacing. Mounted into the player's `sidebar` slot, so its children still run
 * inside the player controller context.
 */
export function WatchSidebar({ children }: WatchSidebarProps) {
  return <div className="flex flex-col gap-[var(--space-4)]">{children}</div>;
}
