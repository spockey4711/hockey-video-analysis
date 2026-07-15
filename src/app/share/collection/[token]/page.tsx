import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  collectionsContent,
  getCollectionByShareToken,
  listReadyClipsForCollection,
  toPlaylistItems,
} from "@/features/share/collections";
import { PlaylistPlayer } from "@/features/share/playlist";
import { PresentationMode } from "@/features/share/presentation";
import {
  ShareEmptyState,
  ShareShell,
  shareMetadata,
} from "@/features/share/shell";

/**
 * The collection clip share link (P2-13). Reached login-free by an unguessable
 * secret token in the URL (`/share/collection/<token>`, the collection's
 * `share_token`), it lists exactly the ready clips a coach curated into the
 * collection as a playlist. A token that resolves to no collection is a 404, so
 * a leaked-but-wrong link is the only thing that fails to open and nothing here
 * confirms which tokens exist. The surface carries `noindex` (see {@link
 * shareMetadata}) and the nav-free {@link ShareShell}, so it is never crawled and
 * never links back into the coach app or another collection's clips.
 */
export const metadata: Metadata = shareMetadata;

export default async function CollectionSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const collection = await getCollectionByShareToken(token);
  if (!collection) notFound();

  const clips = await listReadyClipsForCollection(collection.id);
  const items = toPlaylistItems(clips, process.env.MEDIA_BASE_URL);

  return (
    <ShareShell
      title={collection.name}
      subtitle={collectionsContent.share.fallbackSubtitle}
    >
      {items.length > 0 ? (
        <>
          <PresentationMode items={items} />
          <PlaylistPlayer items={items} />
        </>
      ) : (
        <ShareEmptyState />
      )}
    </ShareShell>
  );
}
