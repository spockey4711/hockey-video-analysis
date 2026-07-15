import type { ElementType, HTMLAttributes } from "react";

import { cn } from "./cn";

/** Semantic heading level, mapped 1:1 to an `<h1>`..`<h6>` element. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Visual size, decoupled from the semantic `level` so the document outline and
 * the type scale can be chosen independently:
 * - `display` - the marketing hero only (`--fs-display`, 56px).
 * - `page` - the single, shared page-title size (`--fs-h2`, 30px). Default.
 * - `sub` - card/row sub-headings such as a roster row (`--fs-title`, 18px).
 */
export type HeadingSize = "display" | "page" | "sub";

const SIZE_CLASS: Record<HeadingSize, string> = {
  display: "text-[length:var(--fs-display)]",
  page: "text-[length:var(--fs-h2)]",
  sub: "text-[length:var(--fs-title)]",
};

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Which `<h*>` element to render for the document outline. Default `2`. */
  level?: HeadingLevel;
  /** Which rung of the type scale to render at. Default `page`. */
  size?: HeadingSize;
}

/**
 * Page and section heading. The one place the Saira display face reaches the
 * app's headings: it applies the display family, tight tracking and the heading
 * line-height in a single spot so every screen shares one heading voice, and it
 * separates the visual `size` from the semantic `level` so a title can look
 * consistent without distorting the document outline. Colour, weight and size
 * defaults route through `cn`, so a caller can override any of them (e.g.
 * `text-balance` on the hero) via `className`.
 */
export function Heading({
  level = 2,
  size = "page",
  className,
  children,
  ...rest
}: HeadingProps) {
  const Tag = `h${level}` as ElementType;

  return (
    <Tag
      className={cn(
        "font-[family-name:var(--font-display)] [line-height:var(--lh-heading)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-tight)] text-[color:var(--text-primary)]",
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
