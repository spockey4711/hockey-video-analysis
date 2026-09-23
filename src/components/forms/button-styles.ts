/**
 * The button look as a plain class-name builder, shared by {@link Button} and by
 * links that must look like a button (a download, a navigation action) without
 * nesting a `<button>` inside an `<a>`. Deliberately not a client module, so a
 * Server Component can style its own anchor with it.
 */
import { cn } from "../core/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center [font-weight:var(--fw-semibold)] whitespace-nowrap transition duration-[var(--dur-fast)] ease-[var(--ease-out)] select-none focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

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

/** Icon size (px) that matches each button size. */
export const BUTTON_ICON_SIZE: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

/** Class names for the button look at the given variant and size. */
export function buttonClassName({
  variant = "primary",
  size = "md",
  full = false,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
} = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], full && "w-full");
}
