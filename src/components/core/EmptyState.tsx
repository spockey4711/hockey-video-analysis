import type { HTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "./Icon";
import { cn } from "./cn";

/**
 * How much room the block claims: `sm` for a slot inside a panel (a list, a
 * fieldset, a rail footer), `md` for a whole panel or card, `lg` for a state
 * that is the page's only content (a share link with nothing on it, a game
 * with no video).
 */
export type EmptyStateSize = "sm" | "md" | "lg";

/** `warning` tints the glyph for a state that is a problem, not just empty. */
export type EmptyStateTone = "neutral" | "warning";

export interface EmptyStateProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** Lucide glyph naming what is missing (e.g. `film`, `scissors`). */
  icon: IconName;
  /** Short headline for the empty state. */
  title: ReactNode;
  /** Optional one-line explanation or next step under the title. */
  hint?: ReactNode;
  /** Optional primary action (e.g. a "New game" link/button). */
  action?: ReactNode;
  /** Scale of the block. Default `md`. */
  size?: EmptyStateSize;
  /** Glyph tint. Default `neutral`. */
  tone?: EmptyStateTone;
  /**
   * Frame the block in the `--surface-inset` well that marks an empty slot
   * inside a panel (a list, a fieldset, a data area under a `PanelHeader`), so
   * the slot still reads as a place content will fill. Leave it off when the
   * block fills a whole card or frame of its own.
   */
  inset?: boolean;
}

const SIZE: Record<
  EmptyStateSize,
  { gap: string; chip: string; icon: number; title: string; hint: string }
> = {
  sm: {
    gap: "gap-[var(--space-2)]",
    chip: "h-[var(--space-8)] w-[var(--space-8)]",
    icon: 16,
    title: "text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]",
    hint: "text-[length:var(--fs-caption)]",
  },
  md: {
    gap: "gap-[var(--space-3)]",
    chip: "h-[var(--space-10)] w-[var(--space-10)]",
    icon: 20,
    title: "text-[length:var(--fs-body)] text-[color:var(--text-secondary)]",
    hint: "text-[length:var(--fs-body-sm)]",
  },
  lg: {
    gap: "gap-[var(--space-3)]",
    chip: "h-[var(--space-12)] w-[var(--space-12)]",
    icon: 24,
    title: "text-[length:var(--fs-title)] text-[color:var(--text-primary)]",
    hint: "text-[length:var(--fs-body-sm)]",
  },
};

const TONE: Record<EmptyStateTone, string> = {
  neutral: "text-[color:var(--text-muted)]",
  warning: "text-[color:var(--warning)]",
};

/**
 * The one empty/placeholder state for anything that has nothing to show yet:
 * a list with no rows, a panel with no data, a slot waiting for a selection, a
 * share link with no clips. A Lucide glyph in an inset chip, a short title (at
 * `--text-secondary` or brighter - the AA-safe rungs the G6 audit calls for), an
 * optional one-line hint and an optional primary action. It carries no surface
 * of its own, so a caller keeps its frame (a `Card`, the player inset) and drops
 * this in where bare text would otherwise sit; `inset` adds the well an empty
 * slot inside a panel sits in. The chip is a hairline-edged disc, sunk into a
 * card and lifted out of a well, so it reads on every surface in both themes.
 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  size = "md",
  tone = "neutral",
  inset = false,
  className,
  ...rest
}: EmptyStateProps) {
  const s = SIZE[size];
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        s.gap,
        inset &&
          "rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)] px-[var(--space-4)] py-[var(--space-6)]",
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-[color:var(--border-subtle)]",
          inset ? "bg-[var(--surface)]" : "bg-[var(--surface-inset)]",
          s.chip,
          TONE[tone],
        )}
      >
        <Icon name={icon} size={s.icon} />
      </span>
      <div className="flex flex-col gap-[var(--space-1)]">
        <p className={cn("[font-weight:var(--fw-semibold)]", s.title)}>
          {title}
        </p>
        {hint ? (
          <p
            className={cn(
              "mx-auto max-w-[32rem] text-[color:var(--text-muted)]",
              s.hint,
            )}
          >
            {hint}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-[var(--space-1)]">{action}</div> : null}
    </div>
  );
}
