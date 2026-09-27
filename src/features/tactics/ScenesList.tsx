import Link from "next/link";

import { tacticsContent } from "./content";
import { ExecutionSummary } from "./executions/ExecutionSummary";
import type { ExecutionStats } from "./executions/outcome";
import type { SceneListItem } from "./queries";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";

const { list, categories, board } = tacticsContent;

const PILL_CLASS =
  "inline-block max-w-full truncate rounded-[var(--radius-pill)] border px-[var(--space-2)] py-[var(--space-1)] leading-tight text-[length:var(--fs-caption)]";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

/**
 * The coach's tactics scenes as a card list, most recently changed first,
 * each with its category, view and tags and, once tagged moments are linked
 * to it, its executions and success rate, or an empty-state card when there
 * are none yet or none passes the filter. Presentational only.
 */
export function ScenesList({
  scenes,
  executions = new Map(),
  filtered = false,
}: {
  scenes: readonly SceneListItem[];
  /** Each scene's execution counts; a scene without executions is absent. */
  executions?: ReadonlyMap<string, ExecutionStats>;
  /** Whether a filter narrowed the list, which changes the empty state. */
  filtered?: boolean;
}) {
  if (scenes.length === 0) {
    const empty = filtered ? list.noMatch : list.empty;
    return (
      <Card className="p-[var(--space-8)]">
        <EmptyState
          icon={filtered ? "search" : "spline"}
          title={empty.title}
          hint={empty.hint}
        />
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-[var(--space-3)]">
      {scenes.map((scene) => (
        <li key={scene.id}>
          <Link href={`/tactics/${scene.id}`} className="block">
            <Card
              interactive
              className="flex flex-col gap-[var(--space-2)] p-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between sm:gap-[var(--space-4)]"
            >
              <span className="flex min-w-0 flex-col gap-[var(--space-2)]">
                <span className="truncate text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
                  {scene.name}
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-[var(--space-1)]">
                  <span
                    className={`${PILL_CLASS} border-[color:var(--border-strong)] bg-[var(--surface-raised)] [font-weight:var(--fw-medium)] text-[color:var(--text-body)]`}
                  >
                    {categories[scene.category]}
                  </span>
                  <span
                    className={`${PILL_CLASS} border-[color:var(--border)] text-[color:var(--text-secondary)]`}
                  >
                    {board.views[scene.view]}
                  </span>
                  {scene.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`${PILL_CLASS} border-transparent bg-[var(--surface-inset)] text-[color:var(--text-secondary)]`}
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              </span>
              <span className="flex shrink-0 flex-col gap-[var(--space-1)] sm:items-end">
                <ExecutionSummary stats={executions.get(scene.id)} />
                <span className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                  {list.updated(DATE_FORMAT.format(scene.updatedAt))}
                </span>
              </span>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
