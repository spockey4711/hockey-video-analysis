"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { watchContent } from "./content";

import { Icon } from "@/components/core/Icon";
import { formatGameClock, usePlayerController } from "@/features/player";

export interface WatchTopBarProps {
  /** The game title, shown as the workspace heading. */
  readonly title: string;
  /** Secondary facts (opponent, date); falsy entries dropped, joined by a middot. */
  readonly meta?: readonly (string | null | undefined | false)[];
  /** Total number of chapters, for the `Kapitel i/n` readout. */
  readonly chapterCount: number;
  /** Primary action slot on the right (the clip-cut control). */
  readonly action?: ReactNode;
}

/**
 * The workspace top bar: a back link to the games list, the game title with a
 * live `Kapitel i/n . M:SS` readout, and a primary action on the right. Reads the
 * active chapter and game time from the player controller, so it must render
 * inside {@link ContinuousPlayer}.
 */
export function WatchTopBar({
  title,
  meta,
  chapterCount,
  action,
}: WatchTopBarProps) {
  const { activeSourceIndex, gameTimeS } = usePlayerController();
  const { topbar } = watchContent;
  const items = (meta ?? []).filter((item): item is string => Boolean(item));

  return (
    <div className="flex h-full items-center gap-[var(--space-4)] px-[var(--space-4)]">
      <Link
        href="/games"
        className="inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]"
      >
        <Icon name="chevron-left" size={16} />
        {topbar.back}
      </Link>

      <div className="flex min-w-0 items-baseline gap-[var(--space-3)]">
        <h1 className="truncate font-[family-name:var(--font-display)] text-[length:var(--fs-title)] leading-[var(--lh-tight)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-tight)] text-[color:var(--text-primary)] uppercase">
          {title}
        </h1>
        <span className="hidden shrink-0 font-[family-name:var(--font-mono)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] tabular-nums sm:inline">
          {topbar.chapter(activeSourceIndex + 1, chapterCount)} .{" "}
          {formatGameClock(gameTimeS)}
        </span>
      </div>

      {items.length > 0 ? (
        <span className="hidden truncate text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] lg:inline">
          {items.join(" · ")}
        </span>
      ) : null}

      {action ? <div className="ms-auto shrink-0">{action}</div> : null}
    </div>
  );
}
