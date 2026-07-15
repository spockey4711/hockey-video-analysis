import type { ElementType, HTMLAttributes, ReactNode } from "react";

import type { HeadingLevel } from "./Heading";
import { cn } from "./cn";

export interface PanelHeaderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** The panel's HUD title, rendered in the caption scale and small-caps. */
  title: ReactNode;
  /** Optional muted sub-line under the title. */
  hint?: ReactNode;
  /**
   * Optional trailing controls (e.g. prev/next), right-aligned across from the
   * title/hint block. The slot never shrinks the title, so long titles wrap
   * rather than crush the action.
   */
  action?: ReactNode;
  /** Which `<h*>` element to render for the document outline. Default `2`. */
  level?: HeadingLevel;
}

/**
 * The shared header for raised workspace panels (see the G3 `Card panel`
 * contract). It locks the one HUD-caption treatment - `--fs-caption`,
 * `--fw-semibold`, `--ls-caps` small-caps in `--text-secondary` over an optional
 * `--text-muted` hint - that the watch, tagging, quarter, suggestion and player
 * panels each used to hand-roll, so the caption scale and tracking can no longer
 * drift between panels. The `action` slot carries a panel's inline controls
 * without changing the header's alignment.
 */
export function PanelHeader({
  title,
  hint,
  action,
  level = 2,
  className,
  ...rest
}: PanelHeaderProps) {
  const Tag = `h${level}` as ElementType;

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-[var(--space-3)]",
        className,
      )}
      {...rest}
    >
      <div className="flex flex-col gap-[var(--space-1)]">
        <Tag className="text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-caps)] text-[color:var(--text-secondary)] uppercase">
          {title}
        </Tag>
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
