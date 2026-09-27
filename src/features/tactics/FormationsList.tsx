import Link from "next/link";

import { InlineRename } from "./InlineRename";
import { tacticsContent } from "./content";
import { renameFormationAction } from "./formation-actions";
import type { FormationListItem } from "./formation-queries";
import { ROW_LINK_CLASS } from "./row-link";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";

const { formations, board, rename } = tacticsContent;

/**
 * The coach's formations as a card list, most recently changed first, each
 * with its kind, view and players per team, or an empty-state card when there
 * are none yet. Each row opens its formation or renames it in place.
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
          <Card
            interactive
            className="flex flex-col gap-[var(--space-1)] p-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between sm:gap-[var(--space-4)]"
          >
            <InlineRename
              idField="formationId"
              id={formation.id}
              name={formation.name}
              action={renameFormationAction}
              fieldLabel={formations.label}
              openLabel={rename.formation(formation.name)}
              className="flex-1"
            >
              {/* The link stretches over the whole card, so the row still
                  opens the formation; the rename controls sit above it. */}
              <Link
                href={`/tactics/formations/${formation.id}`}
                className={ROW_LINK_CLASS}
              >
                {formation.name}
              </Link>
            </InlineRename>
            <span className="shrink-0 text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
              {[
                formations.kinds[formation.kind],
                board.views[formation.view],
                formations.players(formation.players),
              ].join(" · ")}
            </span>
          </Card>
        </li>
      ))}
    </ul>
  );
}
