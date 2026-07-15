"use client";

import type { ReactNode } from "react";

import { PlaybackRateControl } from "./PlaybackRateControl";
import { PlayerControllerProvider } from "./PlayerContext";
import { PlayerScrubBar } from "./PlayerScrubBar";
import { playerContent } from "./content";
import { formatGameClock } from "./format-timecode";
import type { PlayerSource } from "./player-sources";
import { useContinuousPlayback } from "./use-continuous-playback";
import { SKIP_S, STEP_S, useTransportHotkeys } from "./useTransportHotkeys";

import { Icon } from "@/components/core/Icon";
import { IconButton } from "@/components/forms/IconButton";

/**
 * Typed slots for sibling feature lanes to compose over the player without
 * editing this shell (backlog: "leave typed slots for tagging and quarter
 * overlays"). Each is optional and rendered inside the player's context, so slot
 * children may call {@link usePlayerController}.
 */
export interface PlayerSlots {
  /** Rendered absolutely over the video frame (e.g. tag-capture flash, markers). */
  readonly videoOverlay?: ReactNode;
  /** Rendered across the timeline track (e.g. quarter bands, tag ticks). */
  readonly timelineOverlay?: ReactNode;
  /** Rendered beside the player (e.g. the tag capture panel and tag list). */
  readonly sidebar?: ReactNode;
  /** Extra transport controls appended to the control bar (e.g. a tag button). */
  readonly transportExtras?: ReactNode;
}

export interface ContinuousPlayerProps extends PlayerSlots {
  /** Ordered chapter sources; index `i` is chapter `i` on the game timeline. */
  readonly sources: readonly PlayerSource[];
  /** Accessible name for the video element (the game title). */
  readonly title: string;
}

/**
 * The watch page player shell: plays a game's N chapter files as one seamless
 * game timeline (PRD 5.2) and publishes its controller to slot children. The
 * continuous-playback logic lives in {@link useContinuousPlayback}; this
 * component is the layout and transport chrome around it.
 */
export function ContinuousPlayer({
  sources,
  title,
  videoOverlay,
  timelineOverlay,
  sidebar,
  transportExtras,
}: ContinuousPlayerProps) {
  const { videoRef, videoProps, controller } = useContinuousPlayback(sources);
  const { gameTimeS, durationS, isPlaying, isBuffering } = controller;
  const { transport, status } = playerContent;

  useTransportHotkeys(controller);

  return (
    <PlayerControllerProvider value={controller}>
      <div className="flex flex-col gap-[var(--space-6)] lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-3)]">
          <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[image:var(--video-backdrop)]">
            <video
              ref={videoRef}
              title={title}
              playsInline
              // The chapter `src` is set imperatively in useContinuousPlayback so
              // React does not own the attribute and the decoder teardown cannot
              // desync it (see the hook for why).
              //
              // Chapter files are full-game recordings (multi-GB). "auto" makes
              // the browser eagerly buffer the whole file into memory on load,
              // which can exhaust RAM; "metadata" fetches only duration/size and
              // streams byte-ranges on demand, keeping seek/scrub working.
              preload="metadata"
              // The pitch backdrop also backs the <video> itself so it
              // shows through the letterbox bars when a chapter's aspect
              // ratio does not fill the 16:9 frame, not just the container
              // behind it (which the element otherwise fully occludes).
              className="aspect-video w-full bg-[image:var(--video-backdrop)]"
              {...videoProps}
            />
            {/* A clear paused state: a centred badge over the frame whenever the
                game is stopped and not mid-load. Non-interactive - the transport
                buttons and hotkeys drive playback. */}
            {!isPlaying && !isBuffering ? (
              <div
                role="status"
                aria-label={status.paused}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <span className="flex size-[var(--control-lg)] items-center justify-center rounded-full bg-[var(--scrim)] text-[color:var(--text-inverse)]">
                  <Icon name="play" size={22} />
                </span>
              </div>
            ) : null}
            {videoOverlay}
            {isBuffering ? (
              <div
                role="status"
                className="absolute inset-0 flex items-center justify-center bg-[var(--scrim)] text-[length:var(--fs-body-sm)] text-[color:var(--text-inverse)]"
              >
                {status.buffering}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-[var(--space-3)]">
            <div className="flex items-center gap-[var(--space-1)]">
              <IconButton
                name="rewind"
                label={transport.rewind}
                onClick={() => controller.seekBy(-SKIP_S)}
              />
              <IconButton
                name="step-back"
                label={transport.stepBack}
                onClick={() => controller.stepBy(-STEP_S)}
              />
              <IconButton
                name={isPlaying ? "pause" : "play"}
                label={isPlaying ? transport.pause : transport.play}
                variant="solid"
                onClick={controller.togglePlay}
              />
              <IconButton
                name="step-forward"
                label={transport.stepForward}
                onClick={() => controller.stepBy(STEP_S)}
              />
              <IconButton
                name="fast-forward"
                label={transport.forward}
                onClick={() => controller.seekBy(SKIP_S)}
              />
              <PlaybackRateControl />
            </div>

            <PlayerScrubBar
              gameTimeS={gameTimeS}
              durationS={durationS}
              onSeek={controller.seekTo}
              timelineOverlay={timelineOverlay}
            />

            <span className="shrink-0 font-[family-name:var(--font-mono)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)] tabular-nums">
              {formatGameClock(gameTimeS)} / {formatGameClock(durationS)}
            </span>

            {transportExtras}
          </div>
        </div>

        {sidebar ? (
          <aside className="w-full shrink-0 lg:w-[var(--sidebar-w)]">
            {sidebar}
          </aside>
        ) : null}
      </div>
    </PlayerControllerProvider>
  );
}
