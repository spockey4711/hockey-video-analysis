import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";

import { Heading } from "./Heading";
import { Icon } from "./Icon";
import { cn } from "./cn";

export interface PageHeaderProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "title"
> {
  /** The page title, rendered as the page's one `h1`. */
  title: ReactNode;
  /** Optional muted line under the title (what the page does, or its facts). */
  subtitle?: ReactNode;
  /** Optional link up to the parent page, shown above the title. */
  back?: { readonly href: string; readonly label: ReactNode };
  /**
   * Optional page actions (buttons or button-styled links), across from the
   * title block. On a narrow screen they wrap below it.
   */
  actions?: ReactNode;
}

/**
 * The one header for every coach page: an optional chevron back link, the
 * `Heading level={1}` page title over an optional muted subtitle, and an optional
 * actions slot. It locks the back-link treatment, the title rung and one action
 * alignment (bottom-aligned with the title block, so a button lines up with the
 * subtitle) in one place, so pages cannot drift between hand-rolled headers.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  className,
  ...rest
}: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-col gap-[var(--space-4)]", className)}
      {...rest}
    >
      {back ? (
        <div>
          <Link
            href={back.href}
            className="inline-flex items-center gap-[var(--space-1)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] underline-offset-2 hover:text-[color:var(--text-primary)] hover:underline"
          >
            <Icon name="chevron-left" size={14} />
            {back.label}
          </Link>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-[var(--space-4)]">
        <div className="flex min-w-0 flex-col gap-[var(--space-1)]">
          <Heading level={1}>{title}</Heading>
          {subtitle ? (
            <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
