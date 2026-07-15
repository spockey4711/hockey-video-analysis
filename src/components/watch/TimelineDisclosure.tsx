"use client";

import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/core/Icon";

export interface TimelineDisclosureProps {
  /** Glyph for the trigger chip. */
  readonly icon: IconName;
  /** Trigger label and the panel's accessible name. */
  readonly label: string;
  /** The panel revealed above the trigger (a full editor/nav card). */
  readonly children: ReactNode;
}

/**
 * A compact timeline-control chip that reveals a panel above it. Used to re-home
 * the secondary tools (quarter editor, jump-marker nav) onto the bottom timeline
 * without the big sidebar cards. Built on native `<details>` so the panel toggles
 * without extra state and stays keyboard-accessible; the content is positioned
 * upward (the timeline sits at the viewport foot) and, because `<details>` keeps
 * its children mounted while collapsed, the jump-marker hotkeys stay live even
 * when the panel is closed.
 */
export function TimelineDisclosure({
  icon,
  label,
  children,
}: TimelineDisclosureProps) {
  return (
    <details className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-[var(--space-1)] rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[var(--surface-raised)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none">
        <Icon name={icon} size={16} />
        {label}
      </summary>
      <div
        role="group"
        aria-label={label}
        className="absolute bottom-full left-0 z-30 mb-[var(--space-2)] max-h-[60vh] w-[var(--sidebar-w)] overflow-y-auto rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)]"
      >
        {children}
      </div>
    </details>
  );
}
