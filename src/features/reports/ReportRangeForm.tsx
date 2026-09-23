import Link from "next/link";

import { reportsContent } from "./content";
import { isRangeSet, type ReportRange } from "./report-range";

import { Card } from "@/components/core/Card";
import { Button, buttonClassName, Input } from "@/components/forms";

const { range: copy } = reportsContent.team;

/**
 * The team overview's date-range filter: a plain GET form that reloads the
 * page with `?from=&to=`, so it works without client JS and the URL can be
 * bookmarked or shared among coaches. The reset link only shows while a range
 * is set.
 */
export function ReportRangeForm({
  action,
  range,
}: {
  /** The page the form submits to. */
  readonly action: string;
  readonly range: ReportRange;
}) {
  return (
    <Card as="section" aria-label={copy.heading} className="p-[var(--space-4)]">
      <form
        method="get"
        action={action}
        className="flex flex-wrap items-end gap-[var(--space-3)]"
      >
        <div className="w-[11rem]">
          <Input
            type="date"
            name="from"
            label={copy.from}
            defaultValue={range.from ?? ""}
          />
        </div>
        <div className="w-[11rem]">
          <Input
            type="date"
            name="to"
            label={copy.to}
            defaultValue={range.to ?? ""}
          />
        </div>
        <Button type="submit" variant="secondary">
          {copy.apply}
        </Button>
        {isRangeSet(range) ? (
          <Link href={action} className={buttonClassName({ variant: "ghost" })}>
            {copy.reset}
          </Link>
        ) : null}
        <p className="basis-full text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {copy.hint}
        </p>
      </form>
    </Card>
  );
}
