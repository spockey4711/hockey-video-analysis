import type { HTMLAttributes } from "react";

import { cn } from "../core/cn";

export type ClipStatus = "pending" | "processing" | "ready" | "failed";

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Clip-pipeline state (drives the dot color and default label). */
  status: ClipStatus;
  /** Override the default German label for this status. */
  label?: string;
}

/** Dot color and default German label per clip-pipeline status. */
const STATUS: Record<ClipStatus, { dot: string; label: string }> = {
  pending: { dot: "bg-[var(--status-pending)]", label: "In Warteschlange" },
  processing: {
    dot: "bg-[var(--status-processing)]",
    label: "Wird geschnitten",
  },
  ready: { dot: "bg-[var(--status-ready)]", label: "Bereit" },
  failed: { dot: "bg-[var(--status-failed)]", label: "Fehlgeschlagen" },
};

/**
 * Clip-pipeline status pill: a colored state dot plus a label. The `processing`
 * state pulses to signal in-flight work. Colors come from the `--status-*`
 * tokens; the label defaults to German copy and can be overridden.
 */
export function StatusBadge({
  status,
  label,
  className,
  ...rest
}: StatusBadgeProps) {
  const config = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-pill)] border border-[color:var(--border)] bg-[var(--surface-raised)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--fs-caption)] [font-weight:var(--fw-medium)] text-[color:var(--text-body)]",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          "size-[var(--space-2)] shrink-0 rounded-[var(--radius-pill)]",
          config.dot,
          status === "processing" && "animate-pulse",
        )}
      />
      {label ?? config.label}
    </span>
  );
}
