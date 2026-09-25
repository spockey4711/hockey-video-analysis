"use client";

import {
  type ReactNode,
  type Ref,
  type RefObject,
  useRef,
  useState,
} from "react";

import type { PlaybackPlan } from "../playback";

import { StageScrubBar, usePlayheadS } from "./StageScrubBar";
import { stageContent } from "./content";
import { formatClipTime } from "./slider";
import {
  type EditedPlayback,
  type FileRange,
  useEditedPlayback,
} from "./use-edited-playback";
import { useStageFullscreen } from "./use-stage-fullscreen";

import { cn } from "@/components/core/cn";
import { IconButton } from "@/components/forms/IconButton";
import { FRAME_S } from "@/features/player/useTransportHotkeys";
import {
  ClipVideo,
  type ClipSource,
} from "@/features/share/playlist/ClipVideo";
import type { VideoEvent } from "@/features/share/views/client";

export interface EditedClipStageProps {
  /** The playlist's clips in order; the ones after the current load ahead. */
  readonly items: readonly ClipSource[];
  /** The clip on screen; must be a valid index into `items`. */
  readonly index: number;
  /** How the current clip plays: its in and out point on the file's clock. */
  readonly plan: PlaybackPlan;
  /** Always points at the element showing the current clip. */
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  /** The video's accessible title. */
  readonly title: string;
  /**
   * `inline` keeps the picture at 16:9 in the page flow; `fill` fills the
   * parent's height, as in presentation mode.
   */
  readonly layout?: "inline" | "fill";
  /** The stretch the scrub bar covers; defaults to the plan's in and out point. */
  readonly scrubRange?: FileRange;
  /** Offer the stage's own fullscreen; off where the stage already fills the screen. */
  readonly fullscreen?: boolean;
  /** Take the transport away, as while the presenter draws on the picture. */
  readonly hideTransport?: boolean;
  /** Put on the element over the picture, e.g. to follow a pointer across it. */
  readonly pictureRef?: Ref<HTMLDivElement>;
  /** Extra classes for the picture box, e.g. a pointer tool's cursor. */
  readonly pictureClassName?: string;
  /** The current clip has its first frame; see {@link ClipVideo}. */
  readonly onReady?: () => void;
  readonly onPlay?: (event: VideoEvent) => void;
  readonly onPause?: (event: VideoEvent) => void;
  readonly onTimeUpdate?: (event: VideoEvent) => void;
  readonly onSeeked?: (event: VideoEvent) => void;
  /** Playback reached the out point and stopped. */
  readonly onEnded?: (event: VideoEvent) => void;
  /** Laid over the picture, in its coordinates (end card, drawing, title cards). */
  readonly children?: ReactNode;
  /** Rendered under the transport, inside fullscreen too (the editor's tracks). */
  readonly below?: (playback: EditedPlayback) => ReactNode;
}

/**
 * The player for a clip played through its edit (ADR 0011): the full clip
 * file in a picture box, and the app's own transport under it - play and
 * pause, single-frame steps, a clock, a scrub bar kept to the in and out
 * point, sound on or off, and fullscreen.
 *
 * The browser's native controls cannot hold an in and out point and their
 * fullscreen would show the bare video without the edit, so the stage brings
 * its own: fullscreen takes the whole stage, picture, overlays and transport,
 * and where the browser cannot (iPhone Safari) the stage fills the window.
 *
 * It wraps {@link ClipVideo}, so the next clips keep loading ahead exactly as
 * on the plain players, and every media event reaches the caller the same way;
 * `onEnded` comes from the out point rather than the file's end.
 */
export function EditedClipStage({
  items,
  index,
  plan,
  videoRef,
  title,
  layout = "inline",
  scrubRange,
  fullscreen: offersFullscreen = true,
  hideTransport = false,
  pictureRef,
  pictureClassName,
  onReady,
  onPlay,
  onPause,
  onTimeUpdate,
  onSeeked,
  onEnded,
  children,
  below,
}: EditedClipStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const playback = useEditedPlayback(videoRef, plan, {
    clipKey: items[index].id,
    range: scrubRange,
    onEnded,
  });
  const fullscreen = useStageFullscreen(stageRef);
  const [muted, setMuted] = useState(false);
  const { handlers } = playback;
  const fills = layout === "fill" || fullscreen.isActive;

  return (
    <div
      ref={stageRef}
      className={cn(
        "flex flex-col",
        layout === "fill" ? "size-full" : "bg-[var(--surface-inset)]",
        fullscreen.isActive && "bg-[var(--bg-app)]",
        fullscreen.isInPage && "fixed inset-0 z-50",
      )}
    >
      <div
        ref={pictureRef}
        className={cn(
          "relative overflow-hidden",
          fills ? "min-h-0 flex-1" : "aspect-video w-full",
          pictureClassName,
        )}
      >
        <ClipVideo
          items={items}
          index={index}
          videoRef={videoRef}
          onReady={() => {
            playback.cue();
            onReady?.();
          }}
          title={title}
          playsInline
          muted={muted}
          className="absolute inset-0 size-full object-contain"
          onLoadedMetadata={handlers.onLoadedMetadata}
          onPlay={(event) => {
            handlers.onPlay(event);
            onPlay?.(event);
          }}
          onPause={(event) => {
            handlers.onPause(event);
            onPause?.(event);
          }}
          onTimeUpdate={(event) => {
            handlers.onTimeUpdate(event);
            onTimeUpdate?.(event);
          }}
          onSeeked={(event) => {
            handlers.onSeeked(event);
            onSeeked?.(event);
          }}
          onEnded={handlers.onEnded}
        >
          {stageContent.unsupported}
        </ClipVideo>
        {children}
      </div>

      {hideTransport ? null : (
        <StageTransport
          playback={playback}
          muted={muted}
          onToggleMute={() => setMuted((current) => !current)}
          fullscreen={offersFullscreen ? fullscreen : null}
        />
      )}
      {below?.(playback)}
    </div>
  );
}

interface StageTransportProps {
  readonly playback: EditedPlayback;
  readonly muted: boolean;
  readonly onToggleMute: () => void;
  readonly fullscreen: ReturnType<typeof useStageFullscreen> | null;
}

/**
 * The stage's transport: the scrub bar on its own line, so it keeps its width
 * on a phone, and the buttons and clock under it.
 */
function StageTransport({
  playback,
  muted,
  onToggleMute,
  fullscreen,
}: StageTransportProps) {
  const { transport } = stageContent;
  return (
    <div className="flex flex-col gap-[var(--space-1)] px-[var(--space-3)] pt-[var(--space-1)] pb-[var(--space-2)]">
      <StageScrubBar playback={playback} />
      <div className="flex items-center gap-[var(--space-1)]">
        <IconButton
          name={playback.isPlaying ? "pause" : "play"}
          label={playback.isPlaying ? transport.pause : transport.play}
          variant="solid"
          onClick={playback.togglePlay}
        />
        <IconButton
          name="step-back"
          label={transport.frameBack}
          onClick={() => playback.stepBy(-FRAME_S)}
        />
        <IconButton
          name="step-forward"
          label={transport.frameForward}
          onClick={() => playback.stepBy(FRAME_S)}
        />
        <StageClock playback={playback} />
        <div className="ms-auto flex items-center gap-[var(--space-1)]">
          <IconButton
            name={muted ? "volume-x" : "volume-2"}
            label={muted ? transport.unmute : transport.mute}
            active={muted}
            onClick={onToggleMute}
          />
          {fullscreen ? (
            <IconButton
              name={fullscreen.isActive ? "minimize" : "maximize"}
              label={
                fullscreen.isActive
                  ? transport.fullscreenExit
                  : transport.fullscreenEnter
              }
              onClick={fullscreen.toggle}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Position and length in the scrub range, as `0:03,2 / 0:09,8`. */
function StageClock({ playback }: { playback: EditedPlayback }) {
  const fileS = usePlayheadS(playback);
  const { startS, endS } = playback.range;
  const lengthS = Math.max(endS - startS, 0);
  const positionS = Math.min(Math.max(fileS - startS, 0), lengthS);
  return (
    <span className="ms-[var(--space-2)] font-[family-name:var(--font-mono)] text-[length:var(--fs-body-sm)] whitespace-nowrap text-[color:var(--text-secondary)] tabular-nums">
      {formatClipTime(positionS)} / {formatClipTime(lengthS)}
    </span>
  );
}
