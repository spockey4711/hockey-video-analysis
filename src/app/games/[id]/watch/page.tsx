import { notFound } from "next/navigation";

import {
  ClipBoardProvider,
  TimelineDisclosure,
  WatchClipCutButton,
  WatchEmptyState,
  WatchRail,
  WatchTagsRail,
  WatchTopBar,
} from "@/components/watch";
import { requireCoach } from "@/features/access";
import {
  ContinuousPlayer,
  playerContent,
  toPlayerSources,
} from "@/features/player";
import {
  jumpMarkersContent,
  LiveJumpMarkerNav,
  LiveJumpMarkerTrack,
} from "@/features/player/jump-markers";
import { loadWatchGame } from "@/features/player/queries";
import { QuarterEditor, quartersContent } from "@/features/quarters";
import { QuarterTimelineOverlay } from "@/features/quarters/overlay";
import { listQuarters } from "@/features/quarters/queries";
import { listRoster } from "@/features/tag-players/queries";
import { GameTagsProvider, TransportTagButtons } from "@/features/tagging";
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
 * the player is where tagging happens. This is the immersive broadcast-HUD
 * workspace: the page loads the game and fills the {@link ContinuousPlayer}'s
 * typed slots (rail, top bar, transport tag controls, timeline overlays/controls,
 * tags rail) so sibling lanes compose over the player without editing its shell.
 * The quarter editor and jump-marker nav re-home onto the timeline as compact
 * disclosures; the tag list, editing, player assignment and clip cutting live in
 * the right tags rail.
 */
export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coach = await requireCoach(`/games/${id}/watch`);

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

  if (sources.length === 0) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--bg-app)] p-[var(--space-6)]">
        <WatchEmptyState
          title={playerContent.status.empty.title}
          hint={playerContent.status.empty.hint}
        />
      </main>
    );
  }

  const meta = [
    game.opponent
      ? `${playerContent.header.opponentPrefix} ${game.opponent}`
      : null,
    game.playedOn ? formatPlayedOn(game.playedOn) : null,
  ];

  return (
    <GameTagsProvider initialTags={tags}>
      <ClipBoardProvider gameId={game.id}>
        <ContinuousPlayer
          sources={sources}
          title={game.title}
          rail={<WatchRail gameId={game.id} coachName={coach.name} />}
          tagControls={<TransportTagButtons gameId={game.id} />}
          topBar={
            <WatchTopBar
              title={game.title}
              meta={meta}
              chapterCount={sources.length}
              action={<WatchClipCutButton />}
            />
          }
          timelineOverlay={
            <>
              <QuarterTimelineOverlay quarters={quarters} />
              <LiveJumpMarkerTrack />
            </>
          }
          timelineControls={
            <>
              <TimelineDisclosure
                icon="flag"
                label={quartersContent.panelTitle}
              >
                <QuarterEditor gameId={game.id} initialQuarters={quarters} />
              </TimelineDisclosure>
              <TimelineDisclosure
                icon="tag"
                label={jumpMarkersContent.panelTitle}
              >
                <LiveJumpMarkerNav />
              </TimelineDisclosure>
            </>
          }
          aside={<WatchTagsRail roster={roster} />}
        />
      </ClipBoardProvider>
    </GameTagsProvider>
  );
}
