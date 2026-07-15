import type { Metadata } from "next";

import { Card } from "@/components/core/Card";
import { requireCoach } from "@/features/access";
import {
  CollectionsList,
  CreateCollectionForm,
  collectionsContent,
  listCollections,
} from "@/features/share/collections";

const { list } = collectionsContent.coach;

// Coach-only workspace holding secret share links; keep it out of search indexes.
export const metadata: Metadata = {
  title: list.title,
  robots: { index: false, follow: false },
};

/**
 * The collections workspace: every curated clip collection with a control to
 * create the next one. Each collection links to its detail page, where the coach
 * picks the clips it holds and copies its secret share link (P2-13).
 */
export default async function CollectionsPage() {
  await requireCoach("/collections");
  const collections = await listCollections();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <h1 className="text-[length:var(--fs-h2)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
          {list.title}
        </h1>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {list.description}
        </p>
      </div>
      <Card className="p-[var(--space-4)]">
        <CreateCollectionForm />
      </Card>
      <CollectionsList collections={collections} />
    </main>
  );
}
