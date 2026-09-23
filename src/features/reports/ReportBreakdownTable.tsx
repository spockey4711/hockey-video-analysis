import type { ReactNode } from "react";

import type { BreakdownRow } from "./breakdown-rows";
import { reportsContent } from "./content";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";
import { cn } from "@/components/core/cn";
import { TagChip } from "@/components/data/TagChip";
import { TAG_TYPES } from "@/lib/tag-types";

export interface ReportBreakdownTableProps {
  /** Panel title; also names the section landmark. */
  readonly title: string;
  readonly hint?: string;
  /** Header of the row-label column ("Viertel", "Spieler"). */
  readonly rowHeader: string;
  readonly rows: readonly BreakdownRow[];
  /** Rendered in place of the table when there are no rows. */
  readonly empty?: ReactNode;
}

const NUMBER_CELL =
  "px-[var(--space-3)] py-[var(--space-2)] text-right font-[family-name:var(--font-mono)] tabular-nums";

/**
 * One breakdown of the report as a raised panel with a compact table: a label
 * column, one count column per tag type (headed by its coded chip) and the row
 * total. Zero counts are muted so the moments that did happen stand out; the
 * catch-all row (outside quarters, no player) is set apart and subdued.
 */
export function ReportBreakdownTable({
  title,
  hint,
  rowHeader,
  rows,
  empty,
}: ReportBreakdownTableProps) {
  return (
    <Card
      as="section"
      panel
      aria-label={title}
      className="flex flex-col gap-[var(--space-4)] p-[var(--space-5)]"
    >
      <PanelHeader title={title} hint={hint} />
      {rows.length === 0 ? (
        empty
      ) : (
        <div className="-mx-[var(--space-2)] overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--fs-body-sm)]">
            <thead>
              <tr className="border-b border-[color:var(--border)]">
                <th
                  scope="col"
                  className="px-[var(--space-2)] py-[var(--space-2)] text-left text-[length:var(--fs-micro)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-caps)] text-[color:var(--text-muted)] uppercase"
                >
                  {rowHeader}
                </th>
                {TAG_TYPES.map((def) => (
                  <th
                    key={def.key}
                    scope="col"
                    className="px-[var(--space-3)] py-[var(--space-2)] text-right"
                  >
                    <TagChip type={def.key} size="sm" />
                  </th>
                ))}
                <th
                  scope="col"
                  className="px-[var(--space-2)] py-[var(--space-2)] text-right text-[length:var(--fs-micro)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-caps)] text-[color:var(--text-muted)] uppercase"
                >
                  {reportsContent.table.total}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className={cn(
                    "border-b border-[color:var(--border-subtle)] last:border-b-0",
                    row.isRemainder && "bg-[var(--surface-inset)]",
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      "px-[var(--space-2)] py-[var(--space-2)] text-left whitespace-nowrap",
                      row.isRemainder
                        ? "[font-weight:var(--fw-regular)] text-[color:var(--text-muted)] italic"
                        : "[font-weight:var(--fw-medium)] text-[color:var(--text-primary)]",
                    )}
                  >
                    {row.prefix ? (
                      <span className="mr-[var(--space-2)] font-[family-name:var(--font-mono)] text-[color:var(--text-muted)] tabular-nums">
                        {row.prefix}
                      </span>
                    ) : null}
                    {row.label}
                  </th>
                  {TAG_TYPES.map((def) => (
                    <td key={def.key} className={NUMBER_CELL}>
                      <Count value={row.figures.counts[def.key]} />
                    </td>
                  ))}
                  <td
                    className={cn(
                      NUMBER_CELL,
                      "px-[var(--space-2)] [font-weight:var(--fw-semibold)]",
                    )}
                  >
                    <Count value={row.figures.total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** A count, muted when zero so the non-zero moments stand out. */
function Count({ value }: { value: number }) {
  return (
    <span
      className={
        value === 0
          ? "text-[color:var(--text-muted)]"
          : "text-[color:var(--text-primary)]"
      }
    >
      {value}
    </span>
  );
}
