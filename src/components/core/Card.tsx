import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /**
   * Render as a different element. Defaults to `div`; pass `section` for a
   * labelled panel so it keeps its landmark semantics (use with an
   * `aria-label`/`aria-labelledby`).
   */
  as?: "div" | "section";
  /**
   * Floating-layer treatment for a surface anchored over the page (a popover or
   * disclosure panel): the `--surface-raised` background, the full `--border`
   * and `--shadow-lg`, so it reads as lifted above the resting cards beneath it.
   * Modal dialogs sit one step higher still, at `--shadow-pop`.
   */
  overlay?: boolean;
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
 * The one surface container for panels, form cards, clip tiles and list rows.
 * Every panel in the app is a `Card`, so they share one radius, border and
 * surface, and one elevation ramp: resting at `--shadow-sm`, lifting to
 * `--shadow-md` on hover when `interactive`, floating at `--shadow-lg` as an
 * `overlay`. Padding is left to the caller so the same primitive serves dense
 * rows and roomy panels.
 */
export function Card({
  as: Component = "div",
  overlay = false,
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
        overlay &&
          "border-[color:var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)]",
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
