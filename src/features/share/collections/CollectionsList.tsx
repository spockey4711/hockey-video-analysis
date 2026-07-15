import Link from "next/link";

import { collectionsContent } from "./content";
import type { CollectionListItem } from "./queries";

import { Card } from "@/components/core/Card";
import { Icon } from "@/components/core/Icon";

const { list } = collectionsContent.coach;

/**
 * The coach's collections as a card list, newest first, or an empty-state card
 * when there are none yet. Each row links to the collection's detail page where
 * clips are picked and the secret link is copied. Presentational only - the page
 * loads the collections and passes them in.
 */
export function CollectionsList({
  collections,
}: {
  collections: CollectionListItem[];
}) {
  if (collections.length === 0) {
    return (
      <Card className="p-[var(--space-8)] text-center text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
        {list.empty}
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-[var(--space-3)]">
      {collections.map((collection) => (
        <li key={collection.id}>
          <Link href={`/collections/${collection.id}`} className="block">
            <Card
              interactive
              className="flex items-center justify-between gap-[var(--space-4)] p-[var(--space-4)]"
            >
              <span className="min-w-0 truncate text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
                {collection.name}
              </span>
              <span className="inline-flex shrink-0 items-center gap-[var(--space-1)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                <Icon name="film" size={14} aria-hidden />
                {list.clipCount(collection.clipCount)}
              </span>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
