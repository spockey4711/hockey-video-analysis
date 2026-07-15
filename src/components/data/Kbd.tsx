import type { HTMLAttributes } from "react";

import { cn } from "../core/cn";

export type KbdSize = "sm" | "md";

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  size?: KbdSize;
}

const SIZES: Record<KbdSize, string> = {
  sm: "h-[var(--space-5)] min-w-[var(--space-5)] px-[var(--space-1)] text-[length:var(--fs-micro)]",
  md: "h-[var(--control-sm)] min-w-[var(--control-sm)] px-[var(--space-2)] text-[length:var(--fs-caption)]",
};

/**
 * Keyboard key cap for documenting the hotkey tagging workflow. Mono glyph with
 * a subtle bottom edge for the pressed-key depth; token-driven throughout.
 */
export function Kbd({ size = "md", className, children, ...rest }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-b-2 border-[color:var(--border)] border-b-[color:var(--border-strong)] bg-[var(--surface-raised)] [font-family:var(--font-mono)] leading-none [font-weight:var(--fw-medium)] text-[color:var(--text-primary)] shadow-[var(--shadow-sm)]",
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}
