import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  latestCoachCommentByClip,
  listCoachCommentsForClips,
} from "@/features/clips/comments";
import {
  collectionsContent,
  getCollectionByShareToken,
  getPresenterNotes,
  listReadyClipsForCollection,
  toPlaylistItems,
} from "@/features/share/collections";
import { PlaylistPlayer } from "@/features/share/playlist";
import { TeamNote } from "@/features/share/playlist/TeamNote";
import {
  PresentationMode,
  presenterNotesForClips,
} from "@/features/share/presentation";
import {
  ShareEmptyState,
  ShareShell,
  shareMetadata,
} from "@/features/share/shell";
import { getCurrentCoach } from "@/lib/auth";

/**
 * The collection clip share link (P2-13). Reached login-free by an unguessable
 * secret token in the URL (`/share/collection/<token>`, the collection's
 * `share_token`), it lists exactly the ready clips a coach curated into the
 * collection as a playlist. Playback is `manual`: no clip starts or advances on
 * its own, and a finished clip offers replay or the next clip. A token that resolves to no collection is a 404, so
 * a leaked-but-wrong link is the only thing that fails to open and nothing here
 * confirms which tokens exist. The surface carries `noindex` (see {@link
 * shareMetadata}) and the nav-free {@link ShareShell}, so it is never crawled and
 * never links back into the coach app or another collection's clips.
 *
 * Both players count anonymous views against the link (clicks, full views,
 * replays; ADR 0009) through `POST /api/collection-views`: no cookie, nothing
 * stored on the device, and no IP address or user agent kept.
 *
 * A clip the coach commented on while signed in shows that coach comment (the
 * most recent one) under its title; the link shows no other comments.
 *
 * The coach's private presenter notes reach presentation mode only when this
 * request carries a signed-in coach session: the session is resolved here on the
 * server and the notes are read and passed down only then, so a viewer without
 * one never gets them in the HTML, the props or any payload.
 *
 * The coach's notes for the team are the opposite: public to anyone with the
 * link. The intro stands above the clips and opens presentation mode as a
 * title card, and a clip's text shows under it in the playlist and as a card
 * before it in presentation mode.
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
  const coachComments = latestCoachCommentByClip(
    await listCoachCommentsForClips(clips.map((clip) => clip.id)),
  );
  const items = toPlaylistItems(
    clips,
    process.env.MEDIA_BASE_URL,
    coachComments,
  );
  const presenterNotes = (await getCurrentCoach())
    ? presenterNotesForClips(
        await getPresenterNotes(collection.id),
        items.map((item) => item.id),
      )
    : undefined;

  return (
    <ShareShell
      title={collection.name}
      subtitle={collectionsContent.share.subtitle}
    >
      {items.length > 0 ? (
        <>
          {collection.teamNote && (
            <section aria-label={collectionsContent.share.introLabel}>
              <TeamNote
                text={collection.teamNote}
                className="max-w-[75ch] text-[length:var(--fs-body)]"
              />
            </section>
          )}
          <PresentationMode
            items={items}
            playback="manual"
            views={{ shareToken: token }}
            // Spread so a viewer's payload does not even name the prop.
            {...(presenterNotes && { presenterNotes })}
            intro={collection.teamNote ?? undefined}
          />
          <PlaylistPlayer
            items={items}
            playback="manual"
            views={{ shareToken: token }}
          />
        </>
      ) : (
        <ShareEmptyState />
      )}
    </ShareShell>
  );
}
