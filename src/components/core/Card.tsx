import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /**
   * Render as a different element. Defaults to `div`; pass `section` for a
   * labelled workspace panel so it keeps its landmark semantics (use with an
   * `aria-label`/`aria-labelledby`).
   */
  as?: "div" | "section";
  /**
   * Raised workspace-panel treatment: the tighter `--radius-md`, the full
   * `--border`, the `--surface-raised` background and a deliberate `--shadow-md`
   * so a panel reads as floating above the workspace. This is the one contract
   * the watch/tagging/quarter/suggestion/player panels share; without it a
   * `Card` is the softer resting surface used by list and marketing tiles.
   */
  panel?: boolean;
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
  as: Component = "div",
  panel = false,
  interactive = false,
  accent = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Component
      className={cn(
        "relative rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface)] text-[color:var(--text-body)] shadow-[var(--shadow-sm)]",
        panel &&
          "rounded-[var(--radius-md)] border-[color:var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-md)]",
        interactive &&
          "cursor-pointer transition duration-[var(--dur-med)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[color:var(--border)] hover:shadow-[var(--shadow-md)]",
        accent &&
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[var(--border-w-strong)] before:rounded-t-[var(--radius-lg)] before:bg-[var(--accent)] before:content-['']",
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
