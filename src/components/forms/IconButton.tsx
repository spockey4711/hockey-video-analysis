"use client";

import type { ButtonHTMLAttributes, Ref } from "react";

import { cn } from "../core/cn";
import { Icon, type IconName } from "../core/Icon";

export type IconButtonVariant = "ghost" | "solid" | "accent";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> {
  name: IconName;
  /** Accessible name; also shown as the native tooltip. Required. */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Render the pressed/on state (transport toggles, active tools). */
  active?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost:
    "text-[color:var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]",
  solid:
    "border border-[color:var(--border)] bg-[var(--surface-raised)] text-[color:var(--text-primary)] hover:bg-[var(--surface-hover)]",
  accent:
    "bg-[var(--accent)] text-[color:var(--accent-ink)] hover:bg-[var(--accent-hover)]",
};

const SIZES: Record<IconButtonSize, string> = {
  sm: "size-[var(--control-sm)] rounded-[var(--radius-sm)]",
  md: "size-[var(--control-md)] rounded-[var(--radius-md)]",
  lg: "size-[var(--control-lg)] rounded-[var(--radius-md)]",
};

const ICON_SIZE: Record<IconButtonSize, number> = { sm: 16, md: 18, lg: 20 };

/** Square, icon-only control for video transport and toolbars. */
export function IconButton({
  name,
  label,
  variant = "ghost",
  size = "md",
  active = false,
  type = "button",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center transition duration-[var(--dur-fast)] ease-[var(--ease-out)] select-none focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        active && "bg-[var(--surface-hover)] text-[color:var(--text-brand)]",
        className,
      )}
      {...rest}
    >
      <Icon name={name} size={ICON_SIZE[size]} />
    </button>
  );
}
