import Link from "next/link";

import { tacticsContent } from "./content";
import type { SceneListItem } from "./queries";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";

const { list } = tacticsContent;

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

/**
 * The coach's tactics scenes as a card list, most recently changed first, or
 * an empty-state card when there are none yet. Presentational only.
 */
export function ScenesList({ scenes }: { scenes: SceneListItem[] }) {
  if (scenes.length === 0) {
    return (
      <Card className="p-[var(--space-8)]">
        <EmptyState
          icon="spline"
          title={list.empty.title}
          hint={list.empty.hint}
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
              className="flex items-center justify-between gap-[var(--space-4)] p-[var(--space-4)]"
            >
              <span className="min-w-0 truncate text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
                {scene.name}
              </span>
              <span className="shrink-0 text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                {list.updated(DATE_FORMAT.format(scene.updatedAt))}
              </span>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
