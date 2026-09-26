import Link from "next/link";

import { tacticsContent } from "./content";
import type { FormationListItem } from "./formation-queries";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";

const { formations, board } = tacticsContent;

/**
 * The coach's formations as a card list, most recently changed first, each
 * with its kind, view and players per team, or an empty-state card when there
 * are none yet. Presentational only.
 */
export function FormationsList({
  formations: items,
}: {
  formations: readonly FormationListItem[];
}) {
  if (items.length === 0) {
    return (
      <Card className="p-[var(--space-8)]">
        <EmptyState
          icon="users"
          title={formations.empty.title}
          hint={formations.empty.hint}
        />
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-[var(--space-3)]">
      {items.map((formation) => (
        <li key={formation.id}>
          <Link href={`/tactics/formations/${formation.id}`} className="block">
            <Card
              interactive
              className="flex flex-col gap-[var(--space-1)] p-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between sm:gap-[var(--space-4)]"
            >
              <span className="min-w-0 truncate text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
                {formation.name}
              </span>
              <span className="shrink-0 text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                {[
                  formations.kinds[formation.kind],
                  board.views[formation.view],
                  formations.players(formation.players),
                ].join(" · ")}
              </span>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
