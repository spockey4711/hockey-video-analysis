import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getPlayerByShareToken,
  listReadyClipsForPlayer,
  playerShareContent,
  toPlaylistItems,
} from "@/features/share/player";
import { PlaylistPlayer } from "@/features/share/playlist";
import {
  ShareEmptyState,
  ShareShell,
  shareMetadata,
} from "@/features/share/shell";

/**
 * The per-player clip share link (P0-11). Reached login-free by an unguessable
 * secret token in the URL (`/share/player/<token>`, the player's
 * `players.share_token`), it lists every ready clip the player may see - all
 * `team`-visible clips plus that player's own `single` clips - as a playlist. A
 * token that resolves to no player is a 404, so a leaked-but-wrong link is the
 * only thing that fails to open and nothing here confirms which tokens exist.
 * The surface carries `noindex` (see {@link shareMetadata}) and the nav-free
 * {@link ShareShell}, so it is never crawled and never links back into the coach
 * app or another player's clips (PRD 5.5, s8).
 */
export const metadata: Metadata = shareMetadata;

export default async function PlayerSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const player = await getPlayerByShareToken(token);
  if (!player) notFound();

  const clips = await listReadyClipsForPlayer(player.id);
  const items = toPlaylistItems(clips, process.env.MEDIA_BASE_URL);

  return (
    <ShareShell
      title={playerShareContent.page.title}
      subtitle={playerShareContent.page.subtitle}
    >
      {items.length > 0 ? (
        <PlaylistPlayer items={items} />
      ) : (
        <ShareEmptyState />
      )}
    </ShareShell>
  );
}
