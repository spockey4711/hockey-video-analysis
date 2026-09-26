import type { HTMLAttributes, ReactNode } from "react";

import { Heading, type HeadingLevel } from "./Heading";
import { cn } from "./cn";

/**
 * Which `Heading` rung the title renders at: `eyebrow` for the small-caps HUD
 * label over a tool or data panel, `sub` for the title of a form or settings
 * card.
 */
export type PanelHeaderSize = "eyebrow" | "sub";

export interface PanelHeaderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** The panel's title. */
  title: ReactNode;
  /** Optional muted sub-line under the title. */
  hint?: ReactNode;
  /**
   * Optional trailing controls or meta (e.g. prev/next, a count), right-aligned
   * across from the title/hint block. The slot never shrinks the title, so long
   * titles wrap rather than crush the action.
   */
  action?: ReactNode;
  /** Which `<h*>` element to render for the document outline. Default `2`. */
  level?: HeadingLevel;
  /** Which type-scale rung the title renders at. Default `eyebrow`. */
  size?: PanelHeaderSize;
  /**
   * `id` for the heading element, so the surrounding panel can name itself
   * with `aria-labelledby`.
   */
  titleId?: string;
}

/**
 * The one header for every panel and card in the app: a `Heading` title over
 * an optional `--fs-body-sm` `--text-muted` hint, with an optional trailing
 * `action` slot. It locks the title rung, the title-to-hint gap and the hint
 * treatment in one place, so panels cannot drift between hand-rolled variants.
 * Two rungs cover every panel: `eyebrow` (the default - `--fs-caption`
 * `--ls-caps` small caps in `--text-secondary`) for tool and data panels, and
 * `sub` (`--fs-title`) for form and settings cards.
 */
export function PanelHeader({
  title,
  hint,
  action,
  level = 2,
  size = "eyebrow",
  titleId,
  className,
  ...rest
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-[var(--space-3)]",
        className,
      )}
      {...rest}
    >
      <div className="flex min-w-0 flex-col gap-[var(--space-1)]">
        <Heading level={level} size={size} id={titleId}>
          {title}
        </Heading>
        {hint ? (
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {hint}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 items-center gap-[var(--space-1)]">
          {action}
        </div>
      ) : null}
    </div>
  );
}
