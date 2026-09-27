import { executionsContent } from "./content";
import { type ExecutionStats, successRate } from "./outcome";

import { cn } from "@/components/core/cn";

const { summary } = executionsContent;

/**
 * A scene's executions in one line: how many there are and the share of
 * rated ones that worked ("5 Ausführungen - 75 % erfolgreich"). Nothing
 * renders for a scene without executions (no stats, or none counted).
 * Presentational only.
 */
export function ExecutionSummary({
  stats,
  className,
}: {
  readonly stats: ExecutionStats | undefined;
  readonly className?: string;
}) {
  if (!stats || stats.total === 0) return null;
  const rate = successRate(stats);
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]",
        className,
      )}
    >
      <span className="[font-weight:var(--fw-medium)] text-[color:var(--text-body)]">
        {summary.count(stats.total)}
      </span>
      <span aria-hidden="true">-</span>
      <span>{rate === null ? summary.unrated : summary.rate(rate)}</span>
    </span>
  );
}
