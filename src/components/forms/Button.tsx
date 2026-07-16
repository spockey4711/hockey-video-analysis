"use client";

import type { ButtonHTMLAttributes, Ref } from "react";

import { Icon, type IconName } from "../core/Icon";
import { cn } from "../core/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Glyph rendered before the label. */
  iconLeft?: IconName;
  /** Glyph rendered after the label. */
  iconRight?: IconName;
  /** Stretch to the full width of the container. */
  full?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[color:var(--accent-ink)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-press)]",
  secondary:
    "border border-[color:var(--border)] bg-[var(--surface-raised)] text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[var(--surface-hover)]",
  ghost:
    "text-[color:var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]",
  danger:
    "bg-[var(--danger-strong)] text-[color:var(--danger-ink)] hover:brightness-95 active:brightness-90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-[var(--control-sm)] gap-[var(--space-1)] rounded-[var(--radius-sm)] px-[var(--space-3)] text-[length:var(--fs-body-sm)]",
  md: "h-[var(--control-md)] gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-4)] text-[length:var(--fs-body)]",
  lg: "h-[var(--control-lg)] gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-6)] text-[length:var(--fs-title)]",
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

/** Primary action control with variant/size and optional leading/trailing icons. */
export function Button({
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  full = false,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const glyph = ICON_SIZE[size];
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center [font-weight:var(--fw-semibold)] whitespace-nowrap transition duration-[var(--dur-fast)] ease-[var(--ease-out)] select-none focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        full && "w-full",
        className,
      )}
      {...rest}
    >
      {iconLeft && <Icon name={iconLeft} size={glyph} />}
      {children}
      {iconRight && <Icon name={iconRight} size={glyph} />}
    </button>
  );
}
