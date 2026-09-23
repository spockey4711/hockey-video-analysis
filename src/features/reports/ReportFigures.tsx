import type { ReactNode } from "react";

import { reportsContent } from "./content";
import type { FigureRow } from "./report";

import { Card } from "@/components/core/Card";
import { cn } from "@/components/core/cn";
import { TagChip } from "@/components/data/TagChip";
import { TAG_TYPES } from "@/lib/tag-types";

/**
 * The report's headline: one tile per tag type with its count for the whole
 * game, plus the total. Each tile is labelled with the type's own coded chip, so
 * the figures read in the same colors as the tags in the tagging workspace.
 */
export function ReportFigures({ totals }: { totals: FigureRow }) {
  return (
    <section aria-labelledby="report-figures-heading">
      <h2 id="report-figures-heading" className="sr-only">
        {reportsContent.figures.heading}
      </h2>
      <dl className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-5">
        {TAG_TYPES.map((def) => (
          <FigureTile
            key={def.key}
            label={<TagChip type={def.key} size="sm" />}
            value={totals.counts[def.key]}
          />
        ))}
        <FigureTile
          label={
            <span className="text-[length:var(--fs-micro)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-caps)] text-[color:var(--text-secondary)] uppercase">
              {reportsContent.figures.total}
            </span>
          }
          value={totals.total}
          className="col-span-2 sm:col-span-1"
        />
      </dl>
    </section>
  );
}

/** One labelled count; the Card is the `<dl>` group wrapping its dt/dd pair. */
function FigureTile({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: number;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-[var(--space-2)] p-[var(--space-4)]",
        className,
      )}
    >
      <dt className="flex h-[var(--space-5)] items-center">{label}</dt>
      <dd className="font-[family-name:var(--font-mono)] text-[length:var(--fs-h2)] leading-[var(--lh-tight)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)] tabular-nums">
        {value}
      </dd>
    </Card>
  );
}
