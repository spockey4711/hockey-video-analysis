import { notFound } from "next/navigation";

import {
  buildWatchHotkeyGroups,
  ClipBoard,
  HotkeyHints,
  WatchEmptyState,
  WatchHeader,
  WatchLayout,
  WatchSidebar,
} from "@/components/watch";
import { requireCoach } from "@/features/access";
import {
  ContinuousPlayer,
  playerContent,
  toPlayerSources,
} from "@/features/player";
import {
  LiveJumpMarkerNav,
  LiveJumpMarkerTrack,
} from "@/features/player/jump-markers";
import { loadWatchGame } from "@/features/player/queries";
import { QuarterEditor } from "@/features/quarters";
import { QuarterTimelineOverlay } from "@/features/quarters/overlay";
import { listQuarters } from "@/features/quarters/queries";
import { listRoster } from "@/features/tag-players/queries";
import { GameTagsProvider, TaggingPanel } from "@/features/tagging";
import { listGameTags } from "@/features/tagging/edit/queries";

/** Format an ISO date (`YYYY-MM-DD`) for the German-speaking coach audience. */
function formatPlayedOn(playedOn: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${playedOn}T00:00:00Z`));
}

/**
 * Watch a game as one continuous, multi-chapter timeline (PRD 5.2). Coach-only:
 * the player is where tagging happens. This is the shared shell - sibling lanes
 * add hotkey tagging (P0-6) via the player's typed slots rather than editing
 * this page. The quarter overlay (UX-4) fills two of those slots: quarter bands
 * over the timeline track and the editor beside the player.
 */
export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCoach(`/games/${id}/watch`);

  const game = await loadWatchGame(id);
  if (!game) notFound();

  const sources = toPlayerSources(game.chapters, {
    baseUrl: process.env.MEDIA_BASE_URL,
    proxyBaseUrl: process.env.MEDIA_PROXY_BASE_URL,
  });
  const [quarters, tags, roster] = await Promise.all([
    listQuarters(game.id),
    listGameTags(game.id),
    listRoster(),
  ]);

  return (
    <WatchLayout
      header={
        <WatchHeader
          title={game.title}
          meta={[
            game.opponent
              ? `${playerContent.header.opponentPrefix} ${game.opponent}`
              : null,
            game.playedOn ? formatPlayedOn(game.playedOn) : null,
          ]}
        />
      }
    >
      {sources.length > 0 ? (
        <GameTagsProvider initialTags={tags}>
          <ContinuousPlayer
            sources={sources}
            title={game.title}
            timelineOverlay={
              <>
                <QuarterTimelineOverlay quarters={quarters} />
                <LiveJumpMarkerTrack />
              </>
            }
            sidebar={
              <WatchSidebar>
                <TaggingPanel gameId={game.id} roster={roster} />
                <ClipBoard gameId={game.id} />
                <LiveJumpMarkerNav />
                <QuarterEditor gameId={game.id} initialQuarters={quarters} />
                <HotkeyHints groups={buildWatchHotkeyGroups()} />
              </WatchSidebar>
            }
          />
        </GameTagsProvider>
      ) : (
        <WatchEmptyState
          title={playerContent.status.empty.title}
          hint={playerContent.status.empty.hint}
        />
      )}
    </WatchLayout>
  );
}
