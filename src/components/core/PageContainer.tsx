import type { HTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * Which content column a page sits in:
 * - `default` - every top-nav section and the pages under it (`--page-max`).
 * - `form` - a page that is a single form card, such as the new-game and
 *   review pages (`--page-max-form`).
 */
export type PageContainerWidth = "default" | "form";

const WIDTH_CLASS: Record<PageContainerWidth, string> = {
  default: "max-w-[var(--page-max)]",
  form: "max-w-[var(--page-max-form)]",
};

export interface PageContainerProps extends HTMLAttributes<HTMLElement> {
  /** Which content column to render. Default `default`. */
  width?: PageContainerWidth;
}

/**
 * The `<main>` content column of a coach page: centred, with one gutter, one
 * vertical rhythm and one width per page type backed by the layout tokens. Every
 * top-nav section shares the `default` width, so switching sections never moves
 * the content's left edge. A page's loading fallback renders the same container
 * as the page, so the frame does not jump while it loads.
 */
export function PageContainer({
  width = "default",
  className,
  children,
  ...rest
}: PageContainerProps) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]",
        WIDTH_CLASS[width],
        className,
      )}
      {...rest}
    >
      {children}
    </main>
  );
}
