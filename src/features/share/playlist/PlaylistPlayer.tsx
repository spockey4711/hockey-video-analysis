"use client";

import { useRef, useState } from "react";

import { playlistContent } from "./content";
import {
  clampIndex,
  isLast,
  nextIndex,
  prevIndex,
} from "./playlist-navigation";
import type { PlaylistItem } from "./types";

import { Icon } from "@/components/core/Icon";
import { cn } from "@/components/core/cn";
import { IconButton } from "@/components/forms/IconButton";

export interface PlaylistPlayerProps {
  /** Ordered, display-ready items; index `i` is the `i`-th clip in the session. */
  readonly items: readonly PlaylistItem[];
}

/**
 * Login-free clip playlist shared by the team link (P0-10) and the per-player
 * link (P0-11). Plays each clip in order, auto-advancing to the next when one
 * ends and letting the viewer jump around the list. It is deliberately dumb
 * about where the clips come from: it takes an already-resolved {@link
 * PlaylistItem} list (media URL + labels built server-side) and never touches
 * tags, players or the database, so no secret-link recipient can reach anything
 * beyond these clips.
 */
export function PlaylistPlayer({ items }: PlaylistPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Set true when an index change should start playback (a click or auto-advance),
  // then consumed once the new source has loaded. Keeps autoplay off the very
  // first render so the page does not start playing on its own.
  const autoPlayRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  if (items.length === 0) return null;

  const safeIndex = clampIndex(index, items.length);
  const current = items[safeIndex];
  const { transport } = playlistContent;

  function goTo(next: number, autoplay: boolean) {
    autoPlayRef.current = autoplay;
    setIndex(clampIndex(next, items.length));
  }

  function handleLoadedData() {
    if (!autoPlayRef.current) return;
    autoPlayRef.current = false;
    void videoRef.current?.play();
  }

  function handleEnded() {
    // Play straight through the session, then stop on the last clip.
    if (!isLast(safeIndex, items.length)) {
      goTo(nextIndex(safeIndex, items.length), true);
    }
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  return (
    <section
      aria-label={playlistContent.regionLabel}
      className="flex flex-col gap-[var(--space-6)] lg:flex-row lg:items-start"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-3)]">
        <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-inset)]">
          <video
            key={current.id}
            ref={videoRef}
            src={current.src}
            title={current.title}
            controls
            playsInline
            preload="auto"
            className="aspect-video w-full bg-[var(--surface-inset)]"
            onLoadedData={handleLoadedData}
            onEnded={handleEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            {playlistContent.unsupported}
          </video>
        </div>

        <div className="flex items-center gap-[var(--space-3)]">
          <div className="flex items-center gap-[var(--space-1)]">
            <IconButton
              name="chevron-left"
              label={transport.previous}
              disabled={safeIndex === 0}
              onClick={() => goTo(prevIndex(safeIndex, items.length), true)}
            />
            <IconButton
              name={isPlaying ? "pause" : "play"}
              label={isPlaying ? transport.pause : transport.play}
              variant="solid"
              onClick={togglePlay}
            />
            <IconButton
              name="chevron-right"
              label={transport.next}
              disabled={isLast(safeIndex, items.length)}
              onClick={() => goTo(nextIndex(safeIndex, items.length), true)}
            />
          </div>

          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
              {current.title}
            </span>
            {current.subtitle && (
              <span className="truncate text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
                {current.subtitle}
              </span>
            )}
          </div>
        </div>
      </div>

      <nav
        aria-label={playlistContent.playlist.heading}
        className="w-full shrink-0 lg:w-[var(--sidebar-w)]"
      >
        <ol className="flex flex-col gap-[var(--space-1)]">
          {items.map((item, itemIndex) => {
            const active = itemIndex === safeIndex;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => goTo(itemIndex, true)}
                  className={cn(
                    "flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-left transition duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none",
                    active
                      ? "bg-[var(--surface-hover)] text-[color:var(--text-primary)]"
                      : "text-[color:var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]",
                  )}
                >
                  <Icon
                    name={active && isPlaying ? "pause" : "play"}
                    size={14}
                    className={
                      active
                        ? "text-[color:var(--accent)]"
                        : "text-[color:var(--text-muted)]"
                    }
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)]">
                      {item.title}
                    </span>
                    {item.subtitle && (
                      <span className="truncate text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
                        {item.subtitle}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </section>
  );
}
