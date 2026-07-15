import type { HTMLAttributes } from "react";

import { cn } from "../core/cn";

import { playerAvatarClass, playerInitials } from "./player-identity";

export type PlayerChipSize = "sm" | "md";

export interface PlayerChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Player full name; drives the initials and the deterministic avatar color. */
  name: string;
  /** Jersey number, shown as a mono badge on the avatar corner when present. */
  number?: number;
  size?: PlayerChipSize;
  /** Render the name label beside the avatar. */
  showName?: boolean;
}

const AVATAR: Record<PlayerChipSize, string> = {
  sm: "size-[var(--space-6)] text-[length:var(--fs-micro)]",
  md: "size-[var(--space-8)] text-[length:var(--fs-body-sm)]",
};

const NAME: Record<PlayerChipSize, string> = {
  sm: "text-[length:var(--fs-body-sm)]",
  md: "text-[length:var(--fs-body)]",
};

/**
 * Player token: an initials avatar with a deterministic, name-derived color and
 * an optional jersey-number badge and name label. Numbers render mono/tabular,
 * matching the HUD numeric treatment.
 */
export function PlayerChip({
  name,
  number,
  size = "md",
  showName = false,
  className,
  ...rest
}: PlayerChipProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-[var(--space-2)]", className)}
      {...rest}
    >
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center rounded-[var(--radius-pill)] [font-family:var(--font-display)] leading-none [font-weight:var(--fw-semibold)]",
          AVATAR[size],
          playerAvatarClass(name),
        )}
      >
        {playerInitials(name)}
        {number != null && (
          <span className="absolute -right-1 -bottom-1 inline-flex min-w-[var(--space-4)] items-center justify-center rounded-[var(--radius-pill)] border border-[color:var(--border)] bg-[var(--surface-raised)] px-[var(--space-1)] [font-family:var(--font-mono)] text-[length:var(--fs-micro)] leading-none text-[color:var(--text-primary)] tabular-nums">
            {number}
          </span>
        )}
      </span>
      {showName && (
        <span
          className={cn(
            "truncate [font-weight:var(--fw-medium)] text-[color:var(--text-primary)]",
            NAME[size],
          )}
        >
          {name}
        </span>
      )}
    </span>
  );
}
