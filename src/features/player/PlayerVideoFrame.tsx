"use client";

import type { ReactNode, RefObject, VideoHTMLAttributes } from "react";

import { useClockFormat } from "./ClockFormatContext";
import { playerContent } from "./content";

import { Icon } from "@/components/core/Icon";

export interface PlayerVideoFrameProps {
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  /**
   * The stage element itself - the one handed to the Fullscreen API, so the
   * clock and the overlay children stay on top of the video on the big screen.
   */
  readonly stageRef?: RefObject<HTMLDivElement | null>;
  readonly videoProps: VideoHTMLAttributes<HTMLVideoElement>;
  /** Accessible name for the video element (the game title). */
  readonly title: string;
  readonly isPlaying: boolean;
  readonly isBuffering: boolean;
  /** Current game-time offset, shown as the large corner clock. */
  readonly gameTimeS: number;
  /**
   * Toggle playback - the transport's own handler, so the paused badge on the
   * frame starts the game exactly like the transport play button and Space.
   */
  readonly onTogglePlay: () => void;
  /**
   * Whether the coach is drawing on the still (P2-10). The paused badge steps
   * aside then: it would sit in the middle of the drawing and end up in the way.
   */
  readonly isDrawing?: boolean;
  /** Absolutely-positioned children over the frame (tag-capture flash, markers). */
  readonly videoOverlay?: ReactNode;
}

/**
 * The full-bleed video stage of the workspace: the `<video>` over the pitch
 * backdrop, a large game clock in the corner, plus the paused/buffering
 * affordances. The element's `src`, ref and events are owned by
 * {@link useContinuousPlayback} and threaded in as props, so this stays purely
 * presentational.
 */
export function PlayerVideoFrame({
  videoRef,
  stageRef,
  videoProps,
  title,
  isPlaying,
  isBuffering,
  gameTimeS,
  onTogglePlay,
  isDrawing = false,
  videoOverlay,
}: PlayerVideoFrameProps) {
  const formatClock = useClockFormat();
  const { status, transport } = playerContent;

  return (
    <div
      ref={stageRef}
      className="relative flex h-full items-center justify-center overflow-hidden bg-[image:var(--video-backdrop)]"
    >
      <video
        ref={videoRef}
        title={title}
        playsInline
        // See useContinuousPlayback for why `src` is set imperatively and preload
        // stays at "metadata" for these multi-GB chapter files.
        preload="metadata"
        className="h-full w-full bg-[image:var(--video-backdrop)] object-contain"
        {...videoProps}
      />

      {/* Large game clock, top-right. */}
      <span className="pointer-events-none absolute top-[var(--space-4)] right-[var(--space-4)] rounded-[var(--radius-md)] bg-[var(--video-scrim)] px-[var(--space-3)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--fs-h3)] [font-weight:var(--fw-semibold)] text-[color:var(--video-ink)] tabular-nums">
        {formatClock(gameTimeS)}
      </span>

      {videoOverlay}

      {/* A clear paused state: a centred play button over the frame whenever the
          game is stopped and not mid-load (or drawn on). It looks like a play
          button, so it is one - wired to the transport's toggle. Only the button
          itself takes the pointer: the rest of the frame stays click-through.
          It renders after the overlays so it stacks above them - in fullscreen
          the idle cursor catcher would otherwise swallow the tap. */}
      {!isPlaying && !isBuffering && !isDrawing ? (
        <div
          role="status"
          aria-label={status.paused}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <button
            type="button"
            aria-label={transport.play}
            onClick={onTogglePlay}
            className="pointer-events-auto flex size-[var(--control-lg)] cursor-pointer items-center justify-center rounded-full bg-[var(--video-scrim)] text-[color:var(--video-ink)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:brightness-125 focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none"
          >
            <Icon name="play" size={22} />
          </button>
        </div>
      ) : null}

      {isBuffering ? (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center bg-[var(--video-scrim)] text-[length:var(--fs-body-sm)] text-[color:var(--video-ink)]"
        >
          {status.buffering}
        </div>
      ) : null}
    </div>
  );
}
