"use client";

import { useEffect, useRef, useState } from "react";

import { presentationContent } from "./content";
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreenActive,
  isFullscreenSupported,
} from "./fullscreen";

import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import { playlistContent } from "@/features/share/playlist/content";
import {
  clampIndex,
  isLast,
  nextIndex,
  prevIndex,
} from "@/features/share/playlist/playlist-navigation";
import type { PlaylistItem } from "@/features/share/playlist/types";

export interface PresentationModeProps {
  /** The same ordered, display-ready clips the playlist plays, index `i` first. */
  readonly items: readonly PlaylistItem[];
}

/**
 * Fullscreen, distraction-free playback for a team session (P1-8). It launches
 * from a button and, while open, fills the viewport with one large clip and a
 * prominent next button, auto-advancing through the session and stopping on the
 * last clip. It reuses the shared {@link PlaylistItem} contract and the pure
 * playlist navigation, so - like the {@link PlaylistPlayer} it sits beside - it
 * stays dumb about where the clips come from and never reaches past the resolved
 * list on the login-free share surface.
 */
export function PresentationMode({ items }: PresentationModeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Start playback whenever an index change was driven by a user action or an
  // auto-advance; consumed once the new source has loaded.
  const autoPlayRef = useRef(true);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const { transport } = presentationContent;

  // Enter native fullscreen when the overlay opens and reconcile our state if
  // the viewer leaves fullscreen with Escape or the browser chrome.
  useEffect(() => {
    if (!active) return;
    void enterFullscreen(containerRef.current);

    function handleFullscreenChange() {
      // Only treat leaving fullscreen as a close when we actually entered it;
      // browsers without the API never fire this and keep the overlay open.
      if (
        isFullscreenSupported(containerRef.current) &&
        !isFullscreenActive()
      ) {
        setActive(false);
      }
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [active]);

  if (items.length === 0) return null;

  const safeIndex = clampIndex(index, items.length);
  const current = items[safeIndex];
  const atFirst = safeIndex === 0;
  const atLast = isLast(safeIndex, items.length);

  // Navigate with functional updates so keyboard handlers never see a stale
  // index and the effects above can depend only on `active`.
  function goNext() {
    autoPlayRef.current = true;
    setIndex((i) => nextIndex(clampIndex(i, items.length), items.length));
  }

  function goPrev() {
    autoPlayRef.current = true;
    setIndex((i) => prevIndex(clampIndex(i, items.length), items.length));
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  function open() {
    autoPlayRef.current = true;
    setIndex(0);
    setActive(true);
  }

  function close() {
    setActive(false);
    void exitFullscreen();
  }

  function handleLoadedData() {
    if (!autoPlayRef.current) return;
    autoPlayRef.current = false;
    void videoRef.current?.play();
  }

  function handleEnded() {
    // Play straight through the session, then stop on the last clip.
    if (!atLast) goNext();
  }

  if (!active) {
    return (
      <div className="flex justify-center">
        <Button variant="secondary" iconLeft="film" onClick={open}>
          {presentationContent.launch}
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={presentationContent.regionLabel}
      onKeyDown={(event) => {
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
            // Native fullscreen also exits on Escape; closing here covers the
            // unsupported-fullscreen case where no fullscreenchange fires.
            close();
            break;
        }
      }}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-app)] text-[color:var(--text-primary)]"
    >
      <div className="flex items-start justify-between gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-4)]">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[length:var(--fs-title)] [font-weight:var(--fw-semibold)]">
            {current.title}
          </span>
          {current.subtitle && (
            <span className="truncate text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
              {current.subtitle}
            </span>
          )}
        </div>
        <IconButton name="x" label={transport.exit} size="lg" onClick={close} />
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-[var(--space-6)]">
        <video
          key={current.id}
          ref={videoRef}
          src={current.src}
          title={current.title}
          controls
          playsInline
          preload="auto"
          className="max-h-full max-w-full rounded-[var(--radius-lg)] bg-[var(--surface-inset)]"
          onLoadedData={handleLoadedData}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          {playlistContent.unsupported}
        </video>
      </div>

      <div className="flex items-center justify-center gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-6)]">
        <IconButton
          name="chevron-left"
          label={transport.previous}
          size="lg"
          disabled={atFirst}
          onClick={goPrev}
        />
        <IconButton
          name={isPlaying ? "pause" : "play"}
          label={isPlaying ? transport.pause : transport.play}
          variant="solid"
          size="lg"
          onClick={togglePlay}
        />
        <Button
          size="lg"
          iconRight="chevron-right"
          disabled={atLast}
          onClick={goNext}
        >
          {transport.next}
        </Button>
        <span
          aria-live="polite"
          className="text-[length:var(--fs-body)] text-[color:var(--text-muted)] tabular-nums"
        >
          {presentationContent.counter(safeIndex + 1, items.length)}
        </span>
      </div>
    </div>
  );
}
