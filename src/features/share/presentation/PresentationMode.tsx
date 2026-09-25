"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LaserPointer } from "./LaserPointer";
import { presentationContent } from "./content";
import {
  type ActiveTool,
  isPointerShortcut,
  toggleTool,
} from "./presentation-tools";

import { cn } from "@/components/core/cn";
import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import {
  TelestrationLayer,
  TelestrationToolbar,
  telestrationContent,
  useTelestration,
} from "@/features/player/telestration";
import { CoachComment } from "@/features/share/playlist/CoachComment";
import { playlistContent } from "@/features/share/playlist/content";
import {
  clampIndex,
  indexAfterEnd,
  isLast,
  nextIndex,
  type PlaybackMode,
  playsOnSelect,
  prevIndex,
} from "@/features/share/playlist/playlist-navigation";
import type { PlaylistItem } from "@/features/share/playlist/types";
import { viewTracking } from "@/features/share/views/client";
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreenActive,
  isFullscreenSupported,
} from "@/lib/fullscreen";

export interface PresentationModeProps {
  /** The same ordered, display-ready clips the playlist plays, index `i` first. */
  readonly items: readonly PlaylistItem[];
  /**
   * Whether clips start and advance on their own (`continuous`, the default) or
   * only on the viewer's action (`manual`), matching the playlist beside it.
   */
  readonly playback?: PlaybackMode;
  /**
   * Count anonymous views of the clips against this collection link, like the
   * playlist beside it (ADR 0009). Left out, nothing is reported.
   */
  readonly views?: { readonly shareToken: string };
}

/**
 * Fullscreen, distraction-free playback for a team session (P1-8). It launches
 * from a button and, while open, gives almost the whole screen to one large clip:
 * a slim header with the clip's title and the way out, and a compact transport
 * row below. In `continuous` playback it auto-advances through the session and
 * stops on the last clip; in `manual` playback each clip waits for a play press
 * and stops at its end with a replay control beside next. It reuses the shared
 * {@link PlaylistItem} contract and the pure playlist navigation, so - like the
 * {@link PlaylistPlayer} it sits beside - it stays dumb about where the clips
 * come from and never reaches past the resolved list on the login-free share
 * surface.
 */
export function PresentationMode({
  items,
  playback = "continuous",
  views,
}: PresentationModeProps) {
  const [active, setActive] = useState(false);
  const close = useCallback(() => {
    setActive(false);
    void exitFullscreen();
  }, []);

  if (items.length === 0) return null;

  if (!active) {
    return (
      <div className="flex justify-center">
        <Button
          variant="secondary"
          iconLeft="film"
          onClick={() => setActive(true)}
        >
          {presentationContent.launch}
        </Button>
      </div>
    );
  }

  return (
    <PresentationOverlay
      items={items}
      playback={playback}
      views={views}
      onClose={close}
    />
  );
}

interface PresentationOverlayProps extends PresentationModeProps {
  readonly playback: PlaybackMode;
  /** Close the overlay; stable across renders, as fullscreen is entered once. */
  readonly onClose: () => void;
}

/**
 * The open presentation, mounted fresh on every launch so it always starts on
 * the first clip with a clean drawing.
 *
 * The presenter can draw on a paused clip with the watch player's telestration
 * (P2-10): the same tools, pens and widths, the `d` key or the pen button. The
 * drawing lives only in this browser - never saved, exported or sent - and is
 * discarded once the clip plays on or another clip comes up. While it is up,
 * Escape belongs to the drawing, so the first press closes it rather than the
 * presentation.
 *
 * The laser pointer (`p` or its button) puts a glowing dot under the mouse or
 * finger over the video, playing or paused, and hides the cursor there. It
 * draws nothing, so it stays on across clips until switched off. Pointer and
 * drawing never run together: switching one on switches the other off.
 */
function PresentationOverlay({
  items,
  playback,
  views,
  onClose,
}: PresentationOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  // Start playback whenever an index change was driven by a user action or an
  // auto-advance in continuous playback; consumed once the new source has loaded.
  const autoPlayRef = useRef(playsOnSelect(playback));
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // The current clip has played to its end and is waiting for the viewer.
  const [hasEnded, setHasEnded] = useState(false);

  const [isPointing, setIsPointing] = useState(false);

  // Runs as the drawing layer goes up, by button or by `d`: hold the frame
  // still and take the pointer down, as only one tool is on at a time.
  const prepareDrawing = useCallback(() => {
    videoRef.current?.pause();
    setIsPointing(false);
  }, []);
  const telestration = useTelestration(prepareDrawing, videoRef);
  const isDrawing = telestration.state.active;
  const activeTool: ActiveTool = isDrawing
    ? "draw"
    : isPointing
      ? "pointer"
      : null;
  const closeDrawing = telestration.close;
  const isDrawingRef = useRef(isDrawing);
  useEffect(() => {
    isDrawingRef.current = isDrawing;
  });

  const { transport } = presentationContent;

  // Take native fullscreen as the overlay opens, move focus into it so the
  // arrow keys drive it straight away, and close if the viewer leaves
  // fullscreen with Escape or the browser chrome.
  useEffect(() => {
    const container = containerRef.current;
    container?.focus();
    void enterFullscreen(container);

    function handleFullscreenChange() {
      // Only treat leaving fullscreen as a close when we actually entered it;
      // browsers without the API never fire this and keep the overlay open.
      if (!isFullscreenSupported(container) || isFullscreenActive()) return;
      // The browser keeps Escape for leaving fullscreen and never passes it
      // on, so a press while drawing was meant for the drawing: close only
      // that and stay open in the window.
      if (isDrawingRef.current) closeDrawing();
      else onClose();
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [onClose, closeDrawing]);

  const safeIndex = clampIndex(index, items.length);
  const current = items[safeIndex];
  const atFirst = safeIndex === 0;
  const atLast = isLast(safeIndex, items.length);
  const tracking = viewTracking(
    views && { shareToken: views.shareToken, clipId: current.id },
  );

  // Navigate with functional updates so keyboard handlers never see a stale
  // index. A drawing belongs to the clip it was made on, so it goes too.
  function goNext() {
    telestration.close();
    autoPlayRef.current = playsOnSelect(playback);
    setHasEnded(false);
    setIndex((i) => nextIndex(clampIndex(i, items.length), items.length));
  }

  function goPrev() {
    telestration.close();
    autoPlayRef.current = playsOnSelect(playback);
    setHasEnded(false);
    setIndex((i) => prevIndex(clampIndex(i, items.length), items.length));
  }

  function togglePointer() {
    const next = toggleTool(activeTool, "pointer");
    if (isDrawing && next !== "draw") telestration.close();
    setIsPointing(next === "pointer");
  }

  function replay() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play();
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  function handleLoadedData() {
    if (!autoPlayRef.current) return;
    autoPlayRef.current = false;
    void videoRef.current?.play();
  }

  function handleEnded() {
    if (indexAfterEnd(playback, safeIndex, items.length) === null) {
      setHasEnded(true);
    } else {
      goNext();
    }
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={presentationContent.regionLabel}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (isPointerShortcut(event)) {
          event.preventDefault();
          togglePointer();
          return;
        }
        switch (event.key) {
          case "ArrowRight":
            if (!atLast) {
              event.preventDefault();
              goNext();
            }
            break;
          case "ArrowLeft":
            if (!atFirst) {
              event.preventDefault();
              goPrev();
            }
            break;
          case "Escape":
            // The drawing's own Escape binding closes it first.
            if (isDrawing) break;
            // Native fullscreen also exits on Escape; closing here covers the
            // unsupported-fullscreen case where no fullscreenchange fires.
            onClose();
            break;
        }
      }}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-app)] text-[color:var(--text-primary)] outline-none"
    >
      <div className="flex items-start justify-between gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-2)]">
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-[length:var(--fs-body)]">
            <span className="[font-weight:var(--fw-semibold)]">
              {current.title}
            </span>
            {current.subtitle && (
              <span className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                {" - "}
                {current.subtitle}
              </span>
            )}
          </p>
          {current.coachComment && (
            <CoachComment
              text={current.coachComment}
              className="max-w-[90ch] text-[length:var(--fs-body-sm)]"
            />
          )}
        </div>
        <IconButton name="x" label={transport.exit} onClick={onClose} />
      </div>

      <div
        ref={surfaceRef}
        className={cn(
          "relative mx-[var(--space-2)] min-h-0 flex-1 overflow-hidden rounded-[var(--radius-md)] bg-[image:var(--video-backdrop)]",
          // The dot stands in for the cursor, and a finger drag points rather
          // than scrolls.
          activeTool === "pointer" && "cursor-none touch-none",
        )}
      >
        <video
          key={current.id}
          ref={videoRef}
          src={current.src}
          title={current.title}
          // The native bar would sit in the drawing and swallow its strokes.
          controls={!isDrawing}
          playsInline
          preload="auto"
          className="absolute inset-0 size-full object-contain"
          onLoadedData={handleLoadedData}
          onEnded={(event) => {
            tracking?.onEnded(event);
            handleEnded();
          }}
          onPlay={(event) => {
            tracking?.onPlay(event);
            setIsPlaying(true);
            setHasEnded(false);
          }}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={tracking?.onTimeUpdate}
          onSeeked={tracking?.onSeeked}
        >
          {playlistContent.unsupported}
        </video>
        {isDrawing ? (
          <>
            <TelestrationLayer
              state={telestration.state}
              dispatch={telestration.dispatch}
              videoRef={videoRef}
            />
            <TelestrationToolbar
              state={telestration.state}
              dispatch={telestration.dispatch}
              videoRef={videoRef}
              onClose={telestration.close}
            />
          </>
        ) : null}
        {activeTool === "pointer" ? (
          <LaserPointer surfaceRef={surfaceRef} />
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-2)]">
        <IconButton
          name="chevron-left"
          label={transport.previous}
          disabled={atFirst}
          onClick={goPrev}
        />
        {hasEnded && playback === "manual" ? (
          <IconButton
            name="rotate-ccw"
            label={transport.replay}
            variant="solid"
            onClick={replay}
          />
        ) : (
          <IconButton
            name={isPlaying ? "pause" : "play"}
            label={isPlaying ? transport.pause : transport.play}
            variant="solid"
            onClick={togglePlay}
          />
        )}
        <Button iconRight="chevron-right" disabled={atLast} onClick={goNext}>
          {transport.next}
        </Button>
        <IconButton
          name="pen-tool"
          label={telestrationContent.toggle}
          active={isDrawing}
          onClick={telestration.toggle}
        />
        <IconButton
          name="mouse-pointer-2"
          label={presentationContent.pointer}
          active={activeTool === "pointer"}
          onClick={togglePointer}
        />
        <span
          aria-live="polite"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] tabular-nums"
        >
          {presentationContent.counter(safeIndex + 1, items.length)}
        </span>
      </div>
    </div>
  );
}
