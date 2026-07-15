import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Lift and brighten the border on hover; use for clickable tiles/rows.
   * Purely presentational: a `Card` is a `<div>` with no role or focusability,
   * so an `interactive` Card must always sit inside a real `<a>`/`<button>` (as
   * `GameCard`/`RecentGamesPeek` do) and never stand alone as the click target.
   */
  interactive?: boolean;
  /** Draw the brand-green top edge that marks a highlighted surface. */
  accent?: boolean;
}

/**
 * Surface container for panels, clip tiles and list rows. Padding is left to the
 * caller so the same primitive serves dense rows and roomy panels.
 */
export function Card({
  interactive = false,
  accent = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface)] text-[color:var(--text-body)] shadow-[var(--shadow-sm)]",
        interactive &&
          "cursor-pointer transition duration-[var(--dur-med)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[color:var(--border)] hover:shadow-[var(--shadow-md)]",
        accent &&
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[var(--border-w-strong)] before:rounded-t-[var(--radius-lg)] before:bg-[var(--accent)] before:content-['']",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
