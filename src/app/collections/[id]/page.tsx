import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Heading } from "@/components/core/Heading";
import { requireCoach } from "@/features/access";
import { listCommentsForClips } from "@/features/clips/comments";
import {
  CollectionEditor,
  CollectionInsights,
  CollectionSettings,
  collectionSharePath,
  collectionShareUrl,
  collectionsContent,
  getCollectionForEdit,
  getPresenterNotes,
  getTeamNotes,
  listReadyClipsForCuration,
  PresenterNotesEditor,
  TeamNotesEditor,
  toCollectionInsights,
  toCurationItems,
} from "@/features/share/collections";
import { isValidId } from "@/features/share/collections/validation";
import { getCollectionViewStats } from "@/features/share/views";

const { detail } = collectionsContent.coach;

// Coach-only authoring surface holding a secret link; keep it out of search indexes.
export const metadata: Metadata = {
  title: collectionsContent.coach.list.title,
  robots: { index: false, follow: false },
};

/**
 * A collection's detail page: rename it, tick the ready clips it should share,
 * copy or rotate its secret link, read how its clips were viewed and
 * commented on, write the notes for the team that everyone with the link sees,
 * and write the private presenter notes for presentation mode. An unknown or
 * malformed id is a 404, so a guessed URL never confirms which collections
 * exist (P2-13).
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

  const [clips, stats, comments, notes, teamNotes] = await Promise.all([
    listReadyClipsForCuration(),
    getCollectionViewStats(collection.id),
    listCommentsForClips(collection.clipIds),
    getPresenterNotes(collection.id),
    getTeamNotes(collection.id),
  ]);
  const items = toCurationItems(clips, new Set(collection.clipIds));
  const members = items.filter((item) => item.checked);
  const noteClips = members.map((item) => ({
    ...item,
    note: notes.clips[item.id] ?? null,
  }));
  const teamNoteClips = members.map((item) => ({
    ...item,
    note: teamNotes.clips[item.id] ?? null,
  }));
  const insights = toCollectionInsights(items, stats, comments);
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

      <Heading level={1}>{collection.name}</Heading>

      <CollectionSettings
        collectionId={collection.id}
        url={collectionShareUrl(collection.shareToken, baseUrl)}
        path={collectionSharePath(collection.shareToken)}
      />

      <CollectionInsights insights={insights} />

      <CollectionEditor
        collectionId={collection.id}
        name={collection.name}
        items={items}
      />

      <TeamNotesEditor
        collectionId={collection.id}
        collectionNote={teamNotes.collection}
        clips={teamNoteClips}
      />

      <PresenterNotesEditor
        collectionId={collection.id}
        collectionNote={notes.collection}
        clips={noteClips}
      />
    </main>
  );
}
