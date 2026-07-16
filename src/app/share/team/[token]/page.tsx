import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlaylistPlayer } from "@/features/share/playlist";
import { PresentationMode } from "@/features/share/presentation";
import {
  ShareEmptyState,
  ShareShell,
  shareMetadata,
} from "@/features/share/shell";
import {
  listReadyTeamClips,
  teamShareContent,
  toPlaylistItems,
  verifyTeamShareToken,
} from "@/features/share/team";

/**
 * The team clip share link (P0-10). Reached login-free by an unguessable secret
 * token in the URL (`/share/team/<token>`, checked against the server-only
 * `TEAM_SHARE_TOKEN`), it lists every ready, team-visible clip as a playlist. A
 * wrong or missing token - including when the view is disabled - is a 404, so a
 * leaked link is the only thing that resolves and nothing here confirms which
 * tokens exist. The surface carries `noindex` (see {@link shareMetadata}) and
 * the nav-free {@link ShareShell}, so it is never crawled and never links back
 * into the coach app or another player's clips (PRD 5.5, s8).
 */
export const metadata: Metadata = shareMetadata;

export default async function TeamSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!verifyTeamShareToken(token)) notFound();

  const clips = await listReadyTeamClips();
  const items = toPlaylistItems(clips, process.env.MEDIA_BASE_URL);

  return (
    <ShareShell
      title={teamShareContent.page.title}
      subtitle={teamShareContent.page.subtitle}
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
