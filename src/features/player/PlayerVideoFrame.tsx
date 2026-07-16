"use client";

import type { ReactNode, RefObject, VideoHTMLAttributes } from "react";

import { useClockFormat } from "./ClockFormatContext";
import { playerContent } from "./content";

import { Icon } from "@/components/core/Icon";

export interface PlayerVideoFrameProps {
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly videoProps: VideoHTMLAttributes<HTMLVideoElement>;
  /** Accessible name for the video element (the game title). */
  readonly title: string;
  /** REC readout: the active chapter's file name, or a chapter fallback. */
  readonly recLabel: string;
  readonly isPlaying: boolean;
  readonly isBuffering: boolean;
  /** Current game-time offset, shown as the large corner clock. */
  readonly gameTimeS: number;
  /** Absolutely-positioned children over the frame (tag-capture flash, markers). */
  readonly videoOverlay?: ReactNode;
}

/**
 * The full-bleed video stage of the workspace: the `<video>` over the pitch
 * backdrop, a live REC readout and a large game clock in the corners, plus the
 * paused/buffering affordances. The element's `src`, ref and events are owned by
 * {@link useContinuousPlayback} and threaded in as props, so this stays purely
 * presentational.
 */
export function PlayerVideoFrame({
  videoRef,
  videoProps,
  title,
  recLabel,
  isPlaying,
  isBuffering,
  gameTimeS,
  videoOverlay,
}: PlayerVideoFrameProps) {
  const formatClock = useClockFormat();
  const { status } = playerContent;

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-[image:var(--video-backdrop)]">
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

      {/* REC indicator: a pulsing green dot + the chapter file name, top-left. */}
      <div className="pointer-events-none absolute top-[var(--space-4)] left-[var(--space-4)] flex items-center gap-[var(--space-2)] rounded-[var(--radius-pill)] bg-[var(--scrim)] px-[var(--space-3)] py-[var(--space-1)]">
        <span
          className="size-[var(--space-2)] rounded-[var(--radius-pill)] bg-[var(--accent)] shadow-[var(--glow-live)]"
          aria-hidden
        />
        <span className="font-[family-name:var(--font-mono)] text-[length:var(--fs-caption)] tracking-[var(--ls-wide)] text-[color:var(--text-inverse)] uppercase">
          REC . {recLabel}
        </span>
      </div>

      {/* Large game clock, top-right. */}
      <span className="pointer-events-none absolute top-[var(--space-4)] right-[var(--space-4)] rounded-[var(--radius-md)] bg-[var(--scrim)] px-[var(--space-3)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[length:var(--fs-h3)] [font-weight:var(--fw-semibold)] text-[color:var(--text-inverse)] tabular-nums">
        {formatClock(gameTimeS)}
      </span>

      {/* A clear paused state: a centred badge over the frame whenever the game
          is stopped and not mid-load. Non-interactive - the transport buttons
          and hotkeys drive playback. */}
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
  );
}
