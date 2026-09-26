import type { Metadata } from "next";

import { Card } from "@/components/core/Card";
import { PageContainer } from "@/components/core/PageContainer";
import { PageHeader } from "@/components/core/PageHeader";
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
    <PageContainer>
      <PageHeader title={list.title} subtitle={list.description} />
      <Card className="p-[var(--space-4)]">
        <CreateCollectionForm />
      </Card>
      <CollectionsList collections={collections} />
    </PageContainer>
  );
}
