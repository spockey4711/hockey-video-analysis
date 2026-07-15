"use client";

import { useMemo, type ReactNode } from "react";

import { PlayerControllerProvider } from "./PlayerContext";
import { PlayerTimeline } from "./PlayerTimeline";
import { PlayerTransport } from "./PlayerTransport";
import { PlayerVideoFrame } from "./PlayerVideoFrame";
import { PlayerWorkspace } from "./PlayerWorkspace";
import { chapterLanes } from "./chapters";
import { playerContent } from "./content";
import type { PlayerSource } from "./player-sources";
import { useContinuousPlayback } from "./use-continuous-playback";
import { useTransportHotkeys } from "./useTransportHotkeys";

/**
 * Typed slots the watch page composes over the player without editing this shell.
 * Each is rendered inside the player context, so slot children may call
 * {@link usePlayerController}; the tags rail and tag buttons also sit inside the
 * page's `GameTagsProvider`, so they read the live tag store too.
 */
export interface PlayerSlots {
  /** Left icon rail (game-contextual navigation). */
  readonly rail?: ReactNode;
  /** Top bar over the main column (title, chapter readout, primary action). */
  readonly topBar?: ReactNode;
  /** Right rail (the tags list and selected-tag detail panel). */
  readonly aside?: ReactNode;
  /** Tag-capture buttons appended to the transport bar. */
  readonly tagControls?: ReactNode;
  /** Absolutely-positioned children over the video frame. */
  readonly videoOverlay?: ReactNode;
  /** Bands/ticks drawn across the timeline track (quarter bands, tag markers). */
  readonly timelineOverlay?: ReactNode;
  /** Controls above the timeline (jump-to-tag nav, quarter editor). */
  readonly timelineControls?: ReactNode;
}

export interface ContinuousPlayerProps extends PlayerSlots {
  /** Ordered chapter sources; index `i` is chapter `i` on the game timeline. */
  readonly sources: readonly PlayerSource[];
  /** Accessible name for the video element (the game title). */
  readonly title: string;
}

/**
 * The watch workspace shell: plays a game's N chapter files as one seamless game
 * timeline (PRD 5.2) and lays out the broadcast HUD ({@link PlayerWorkspace})
 * around it, publishing its controller to every region. The continuous-playback
 * logic lives in {@link useContinuousPlayback}; this component is the layout and
 * chrome, filled from the page via typed slots.
 */
export function ContinuousPlayer({
  sources,
  title,
  rail,
  topBar,
  aside,
  tagControls,
  videoOverlay,
  timelineOverlay,
  timelineControls,
}: ContinuousPlayerProps) {
  const { videoRef, videoProps, activeSource, controller } =
    useContinuousPlayback(sources);
  const { gameTimeS, durationS, isPlaying, isBuffering, activeSourceIndex } =
    controller;

  useTransportHotkeys(controller);

  const lanes = useMemo(
    () => chapterLanes(sources.map((source) => source.durationS)),
    [sources],
  );
  const recLabel =
    activeSource.label || playerContent.chapterFallback(activeSourceIndex + 1);

  return (
    <PlayerControllerProvider value={controller}>
      <PlayerWorkspace
        rail={rail}
        topBar={topBar}
        aside={aside}
        video={
          <PlayerVideoFrame
            videoRef={videoRef}
            videoProps={videoProps}
            title={title}
            recLabel={recLabel}
            isPlaying={isPlaying}
            isBuffering={isBuffering}
            gameTimeS={gameTimeS}
            videoOverlay={videoOverlay}
          />
        }
        transport={
          <PlayerTransport controller={controller} tagControls={tagControls} />
        }
        timeline={
          <PlayerTimeline
            gameTimeS={gameTimeS}
            durationS={durationS}
            onSeek={controller.seekTo}
            lanes={lanes}
            timelineOverlay={timelineOverlay}
            controls={timelineControls}
          />
        }
      />
    </PlayerControllerProvider>
  );
}
