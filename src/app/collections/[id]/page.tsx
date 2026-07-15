import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCoach } from "@/features/access";
import {
  CollectionEditor,
  CollectionSettings,
  collectionSharePath,
  collectionShareUrl,
  collectionsContent,
  getCollectionForEdit,
  listReadyClipsForCuration,
  toCurationItems,
} from "@/features/share/collections";
import { isValidId } from "@/features/share/collections/validation";

const { detail } = collectionsContent.coach;

// Coach-only authoring surface holding a secret link; keep it out of search indexes.
export const metadata: Metadata = {
  title: collectionsContent.coach.list.title,
  robots: { index: false, follow: false },
};

/**
 * A collection's detail page: rename it, tick the ready clips it should share,
 * and copy or rotate its secret link. An unknown or malformed id is a 404, so a
 * guessed URL never confirms which collections exist (P2-13).
 */
export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCoach(`/collections/${id}`);
  if (!isValidId(id)) notFound();

  const collection = await getCollectionForEdit(id);
  if (!collection) notFound();

  const clips = await listReadyClipsForCuration();
  const items = toCurationItems(clips, new Set(collection.clipIds));
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <div>
        <Link
          href="/collections"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] underline-offset-2 hover:underline"
        >
          {detail.back}
        </Link>
      </div>

      <h1 className="text-[length:var(--fs-h2)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
        {collection.name}
      </h1>

      <CollectionSettings
        collectionId={collection.id}
        url={collectionShareUrl(collection.shareToken, baseUrl)}
        path={collectionSharePath(collection.shareToken)}
      />

      <CollectionEditor
        collectionId={collection.id}
        name={collection.name}
        items={items}
      />
    </main>
  );
}
