import type { HTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "./Icon";
import { cn } from "./cn";

export interface EmptyStateProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** Lucide glyph naming what is missing (e.g. `film`, `scissors`). */
  icon: IconName;
  /** Short headline for the empty state, one `--text-secondary` line. */
  title: ReactNode;
  /** Optional one-line explanation or next step under the title. */
  hint?: ReactNode;
  /** Optional primary action (e.g. a "New game" link/button). */
  action?: ReactNode;
}

/**
 * The shared empty/placeholder state for a screen or panel that has nothing to
 * show yet. It replaces the single line of `--text-muted` body copy each surface
 * used to hand-roll (games list, recent-games peek, watch no-video, clip board)
 * with a reference-grade block: a Lucide glyph in a raised chip, a short title in
 * `--text-secondary` (the AA-safe rung the G6 audit calls for), an optional
 * one-line hint and an optional primary action. It carries no surface of its own
 * so a caller keeps its existing frame (a `Card`, the player inset) and just
 * drops this in where the bare text used to be.
 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-[var(--space-3)] text-center",
        className,
      )}
      {...rest}
    >
      <span className="flex h-[var(--space-10)] w-[var(--space-10)] items-center justify-center rounded-full bg-[var(--surface-raised)] text-[color:var(--text-muted)]">
        <Icon name={icon} size={22} />
      </span>
      <div className="flex flex-col gap-[var(--space-1)]">
        <p className="text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-secondary)]">
          {title}
        </p>
        {hint ? (
          <p className="mx-auto max-w-[32rem] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {hint}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-[var(--space-1)]">{action}</div> : null}
    </div>
  );
}
