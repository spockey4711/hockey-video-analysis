import type { HTMLAttributes } from "react";

import { cn } from "../core/cn";

import { type TagType, tagTypeLabel } from "./tag-types";

export type TagChipSize = "sm" | "md";

export interface TagChipProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  "color"
> {
  /** Which coded moment this chip represents (drives the `--tag-*` color). */
  type: TagType;
  /** Override the default German label from the tag-type config. */
  label?: string;
  size?: TagChipSize;
  /** Filled variant vs the default soft tinted outline. */
  solid?: boolean;
}

/** Soft (tinted outline) and solid (filled) class pair per tag type. */
const TAG_COLORS: Record<TagType, { soft: string; solid: string }> = {
  tor: {
    soft: "border-[color:var(--tag-tor)] bg-[color-mix(in_oklab,var(--tag-tor)_14%,transparent)] text-[color:var(--tag-tor)]",
    solid:
      "border-transparent bg-[var(--tag-tor)] text-[color:var(--tag-tor-ink)]",
  },
  ecke: {
    soft: "border-[color:var(--tag-ecke)] bg-[color-mix(in_oklab,var(--tag-ecke)_14%,transparent)] text-[color:var(--tag-ecke)]",
    solid:
      "border-transparent bg-[var(--tag-ecke)] text-[color:var(--tag-ecke-ink)]",
  },
  gut: {
    soft: "border-[color:var(--tag-gut)] bg-[color-mix(in_oklab,var(--tag-gut)_14%,transparent)] text-[color:var(--tag-gut)]",
    solid:
      "border-transparent bg-[var(--tag-gut)] text-[color:var(--tag-gut-ink)]",
  },
  schlecht: {
    soft: "border-[color:var(--tag-schlecht)] bg-[color-mix(in_oklab,var(--tag-schlecht)_14%,transparent)] text-[color:var(--tag-schlecht)]",
    solid:
      "border-transparent bg-[var(--tag-schlecht)] text-[color:var(--tag-schlecht-ink)]",
  },
  whistle: {
    soft: "border-[color:var(--tag-whistle)] bg-[color-mix(in_oklab,var(--tag-whistle)_14%,transparent)] text-[color:var(--tag-whistle)]",
    solid:
      "border-transparent bg-[var(--tag-whistle)] text-[color:var(--tag-whistle-ink)]",
  },
};

const SIZES: Record<TagChipSize, string> = {
  sm: "h-[var(--space-5)] px-[var(--space-2)] text-[length:var(--fs-micro)]",
  md: "h-[var(--control-sm)] px-[var(--space-3)] text-[length:var(--fs-caption)]",
};

/**
 * Coded chip for a tag type (Tor, Ecke kurz, Aktion gut/schlecht, Vorschlag).
 * UPPERCASE display type with wide tracking for the HUD feel; the color comes
 * from the semantic `--tag-*` tokens. The label defaults to the German copy in
 * the tag-type config and can be overridden per instance.
 */
export function TagChip({
  type,
  label,
  size = "md",
  solid = false,
  className,
  ...rest
}: TagChipProps) {
  const colors = TAG_COLORS[type];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-pill)] border [font-family:var(--font-display)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-caps)] whitespace-nowrap uppercase",
        SIZES[size],
        solid ? colors.solid : colors.soft,
        className,
      )}
      {...rest}
    >
      {label ?? tagTypeLabel(type)}
    </span>
  );
}
