import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Heading } from "@/components/core/Heading";
import { Icon } from "@/components/core/Icon";
import { buttonClassName } from "@/components/forms/button-styles";
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
  listSceneEntries,
  PresenterNotesEditor,
  SceneEntriesEditor,
  TeamNotesEditor,
  toCollectionInsights,
  toCurationItems,
  toRunningOrder,
} from "@/features/share/collections";
import { isValidId } from "@/features/share/collections/validation";
import { getCollectionViewStats } from "@/features/share/views";
import { listScenes } from "@/features/tactics";

const { detail } = collectionsContent.coach;

// Coach-only authoring surface holding a secret link; keep it out of search indexes.
export const metadata: Metadata = {
  title: collectionsContent.coach.list.title,
  robots: { index: false, follow: false },
};

/**
 * A collection's detail page: rename it, tick the ready clips it should share,
 * copy or rotate its secret link, read how its clips were viewed and
 * commented on, place tactics scenes between the clips (ADR 0013), write the
 * notes for the team that everyone with the link sees,
 * and write the private presenter notes for presentation mode. The clip
 * editor opens from here in a new tab, for the whole collection or one clip;
 * an empty collection opens it too, to pick its clips there.
 * An unknown or malformed id is a 404, so a guessed URL never confirms which
 * collections exist (P2-13).
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

  const [clips, stats, comments, notes, teamNotes, sceneEntries, scenes] =
    await Promise.all([
      listReadyClipsForCuration(),
      getCollectionViewStats(collection.id),
      listCommentsForClips(collection.clipIds),
      getPresenterNotes(collection.id),
      getTeamNotes(collection.id),
      listSceneEntries(collection.id),
      listScenes(),
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
  const placedSceneIds = new Set(sceneEntries.map((entry) => entry.sceneId));
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

      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
        <Heading level={1}>{collection.name}</Heading>
        <a
          href={`/collections/${collection.id}/editor`}
          target="_blank"
          rel="noreferrer"
          className={buttonClassName({ variant: "secondary", size: "md" })}
        >
          <Icon name="scissors" size={16} />
          {detail.openEditor}
        </a>
      </div>

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

      <SceneEntriesEditor
        collectionId={collection.id}
        choices={scenes
          .filter((scene) => !placedSceneIds.has(scene.id))
          .map(({ id, name }) => ({ id, name }))}
        hasScenes={scenes.length > 0}
        order={toRunningOrder(members, sceneEntries)}
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
