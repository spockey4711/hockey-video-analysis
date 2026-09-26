"use client";

import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ZoomRect } from "../edit";
import type { PlaybackPlan } from "../playback";

import { MarksOverlay } from "./MarksOverlay";
import { StageScrubBar, usePlayheadS } from "./StageScrubBar";
import { stageContent } from "./content";
import { usePictureZoom } from "./picture-zoom";
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

/** The picture's width over its height until the video says otherwise. */
const DEFAULT_ASPECT = 16 / 9;

/**
 * Play and pause for a caller's own buttons around the stage. The element
 * alone reads as paused while a freezing marker holds the picture, so buttons
 * outside the stage play and pause through these instead.
 */
export interface StageControl {
  readonly togglePlay: () => void;
  readonly pause: () => void;
}

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
  /**
   * Laid over the picture box, unzoomed and in screen space (end card, the
   * presenter's drawing and pointer, title cards).
   */
  readonly children?: ReactNode;
  /**
   * Laid over the picture itself, unzoomed, sized and placed exactly on the
   * video frame, above the markers (the editor's zoom frame and drawing layer).
   * A function gets the playback, e.g. to follow the playhead.
   */
  readonly pictureOverlay?:
    ReactNode | ((playback: EditedPlayback) => ReactNode);
  /** Show this crop instead of the plan's, e.g. the whole picture while the editor sets one. */
  readonly zoom?: ZoomRect;
  /** Rendered under the transport, inside fullscreen too (the editor's tracks). */
  readonly below?: (playback: EditedPlayback) => ReactNode;
  /**
   * Whether the plan's markers show (D6). Hidden markers neither draw nor
   * freeze the picture; zoom and slow motion play on regardless.
   */
  readonly showMarks?: boolean;
  /** Offer a markers on/off switch in the transport, which calls this. */
  readonly onToggleMarks?: () => void;
  /** Receives the stage's play and pause, see {@link StageControl}. */
  readonly controlRef?: Ref<StageControl>;
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
 * The plan's markers are drawn over the picture while they show, following
 * its zoom, and a freezing one holds the picture for its time (D6); a caller
 * can switch them off with `showMarks`, and offer the switch in the transport.
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
  pictureOverlay,
  zoom,
  below,
  showMarks = true,
  onToggleMarks,
  controlRef,
}: EditedClipStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  // Hidden markers leave the plan the player follows, so they cannot freeze it.
  const played = useMemo(
    () => (showMarks ? plan : { ...plan, marks: [] }),
    [plan, showMarks],
  );
  const playback = useEditedPlayback(videoRef, played, {
    clipKey: items[index].id,
    range: scrubRange,
    onPlay,
    onPause,
    onEnded,
  });
  const { togglePlay, pause } = playback;
  useImperativeHandle(controlRef, () => ({ togglePlay, pause }), [
    togglePlay,
    pause,
  ]);
  const fullscreen = useStageFullscreen(stageRef);
  const [muted, setMuted] = useState(false);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const { handlers } = playback;
  const fills = layout === "fill" || fullscreen.isActive;
  usePictureZoom(zoomRef, plan, playback.playhead, zoom);

  // The picture frame takes the current video's shape once it is known.
  function measure() {
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      setAspect(video.videoWidth / video.videoHeight);
    }
  }

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
          "[container-type:size] relative overflow-hidden",
          fills ? "min-h-0 flex-1" : "aspect-video w-full",
          pictureClassName,
        )}
      >
        {/* The video frame, fitted into the box like `object-contain`: it
            clips the zoomed picture to the frame, so the letterbox bars stay
            bars on every screen. */}
        <div
          data-testid="picture-frame"
          className="absolute inset-0 m-auto h-[min(100cqh,calc(100cqw/var(--picture-aspect)))] w-[min(100cqw,calc(100cqh*var(--picture-aspect)))] overflow-hidden"
          style={{ "--picture-aspect": aspect } as CSSProperties}
        >
          <div
            ref={zoomRef}
            data-testid="picture-zoom"
            className="absolute inset-0 origin-top-left"
          >
            <ClipVideo
              items={items}
              index={index}
              videoRef={videoRef}
              onReady={() => {
                measure();
                playback.cue();
                onReady?.();
              }}
              title={title}
              playsInline
              muted={muted || playback.isSlow}
              className="absolute inset-0 size-full object-contain"
              onLoadedMetadata={(event) => {
                measure();
                handlers.onLoadedMetadata(event);
              }}
              onPlay={handlers.onPlay}
              onPause={handlers.onPause}
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
          </div>
          {played.marks.length > 0 ? (
            <MarksOverlay
              plan={played}
              playhead={playback.playhead}
              held={playback.held}
              zoom={zoom}
            />
          ) : null}
          {typeof pictureOverlay === "function"
            ? pictureOverlay(playback)
            : pictureOverlay}
        </div>
        {children}
      </div>

      {hideTransport ? null : (
        <StageTransport
          playback={playback}
          muted={muted}
          onToggleMute={() => setMuted((current) => !current)}
          marks={
            onToggleMarks ? { shown: showMarks, toggle: onToggleMarks } : null
          }
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
  /** The markers switch, when the stage offers one. */
  readonly marks: {
    readonly shown: boolean;
    readonly toggle: () => void;
  } | null;
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
  marks,
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
          {marks ? (
            <IconButton
              name={marks.shown ? "eye" : "eye-off"}
              label={transport.marks}
              active={marks.shown}
              onClick={marks.toggle}
            />
          ) : null}
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
