import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireCoach } from "@/features/access";
import { ClipEditor } from "@/features/clip-editor/ClipEditor";
import { clipEditorContent } from "@/features/clip-editor/content";
import { toEditorEntries } from "@/features/clip-editor/entries";
import { listEditorEntries } from "@/features/clip-editor/queries";
import {
  collectionSharePath,
  getCollectionForEdit,
} from "@/features/share/collections";
import { isValidId } from "@/features/share/collections/validation";

// Coach-only authoring surface holding a secret link; keep it out of search indexes.
export const metadata: Metadata = {
  title: clipEditorContent.title,
  robots: { index: false, follow: false },
};

/**
 * The clip editor for one collection (ADR 0011): a full-window coach page,
 * opened from the collection page, usually in its own tab. `?clip=<id>` picks
 * the clip it opens on. An unknown or malformed id is a 404, like the
 * collection page, so a guessed URL never confirms which collections exist.
 */
export default async function ClipEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  await requireCoach(`/collections/${id}/editor`);
  if (!isValidId(id)) notFound();

  const collection = await getCollectionForEdit(id);
  if (!collection) notFound();

  const { clip } = await searchParams;
  const entries = toEditorEntries(
    await listEditorEntries(collection.id),
    process.env.MEDIA_BASE_URL,
  );

  return (
    <ClipEditor
      collectionId={collection.id}
      collectionName={collection.name}
      sharePath={collectionSharePath(collection.shareToken)}
      entries={entries}
      initialClipId={typeof clip === "string" ? clip : undefined}
    />
  );
}
