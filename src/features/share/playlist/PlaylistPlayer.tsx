"use client";

import { useRef, useState } from "react";

import { ClipVideo } from "./ClipVideo";
import { CoachComment } from "./CoachComment";
import { TeamNote } from "./TeamNote";
import { playlistContent } from "./content";
import {
  clampIndex,
  indexAfterEnd,
  isLast,
  nextIndex,
  type PlaybackMode,
  playsOnSelect,
  prevIndex,
} from "./playlist-navigation";
import type { PlaylistItem } from "./types";

import { Icon } from "@/components/core/Icon";
import { cn } from "@/components/core/cn";
import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import { EditedClipStage } from "@/features/clip-edits/stage/EditedClipStage";
import { CommentThread } from "@/features/clips/comments/CommentThread";
import { type VideoEvent, viewTracking } from "@/features/share/views/client";

export interface PlaylistPlayerProps {
  /** Ordered, display-ready items; index `i` is the `i`-th clip in the session. */
  readonly items: readonly PlaylistItem[];
  /**
   * Mount a comment thread for the current clip (P2-3). `shareToken` is the
   * secret from the page URL the viewer already holds; the comments API checks
   * it reaches the clip. Left out, no thread renders.
   */
  readonly comments?: { readonly shareToken: string };
  /**
   * Whether clips start and advance on their own (`continuous`, the default) or
   * only on the viewer's action (`manual`). See {@link PlaybackMode}.
   */
  readonly playback?: PlaybackMode;
  /**
   * Count anonymous views of the clips (ADR 0009): clicks, full views and
   * replays, reported against `shareToken`, the collection link the viewer
   * holds. Left out, nothing is reported (the team and player links).
   */
  readonly views?: { readonly shareToken: string };
}

/**
 * Login-free clip playlist shared by the team link (P0-10) and the per-player
 * link (P0-11), and the collection link (P2-13). In `continuous` playback it
 * plays each clip in order, auto-advancing to the next when one ends; in
 * `manual` playback nothing starts or advances on its own and a finished clip
 * offers replay and next. Either way the viewer can jump around the list. It is deliberately dumb
 * about where the clips come from: it takes an already-resolved {@link
 * PlaylistItem} list (media URL + labels built server-side) and never touches
 * tags, players or the database, so no secret-link recipient can reach anything
 * beyond these clips. The optional comment thread (P2-3) follows the current
 * clip and goes through the comments API, which re-checks the share token per
 * clip, so the same boundary holds for reading and writing comments.
 *
 * A clip with a playback plan (the collection link, ADR 0011) plays on the
 * {@link EditedClipStage} with the app's own controls, from its in to its out
 * point; a clip without one plays whole with the browser's controls.
 */
export function PlaylistPlayer({
  items,
  comments,
  playback = "continuous",
  views,
}: PlaylistPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Set true when an index change should start playback (a click or auto-advance
  // in continuous playback), then consumed once the new source has loaded. Keeps
  // autoplay off the very first render so the page does not start playing on its
  // own.
  const autoPlayRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // The current clip has played to its end and is waiting for the viewer.
  const [hasEnded, setHasEnded] = useState(false);

  if (items.length === 0) return null;

  const safeIndex = clampIndex(index, items.length);
  const current = items[safeIndex];
  const { transport } = playlistContent;
  const { plan } = current;
  const tracking = viewTracking(
    views && {
      shareToken: views.shareToken,
      clipId: current.id,
      ...(plan && { window: { inS: plan.inS, outS: plan.outS } }),
    },
  );

  function goTo(next: number) {
    autoPlayRef.current = playsOnSelect(playback);
    setHasEnded(false);
    // The clip going off screen stops without a `pause` the player hears.
    setIsPlaying(false);
    setIndex(clampIndex(next, items.length));
  }

  function handleLoadedData() {
    if (!autoPlayRef.current) return;
    autoPlayRef.current = false;
    void videoRef.current?.play();
  }

  function handleEnded(event: VideoEvent) {
    tracking?.onEnded(event);
    const next = indexAfterEnd(playback, safeIndex, items.length);
    if (next === null) setHasEnded(true);
    else goTo(next);
  }

  function replay() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = plan?.inS ?? 0;
    void video.play();
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  // The same media events reach the view counting on either player.
  const media = {
    onPlay(event: VideoEvent) {
      tracking?.onPlay(event);
      setIsPlaying(true);
      setHasEnded(false);
    },
    onPause: () => setIsPlaying(false),
    onTimeUpdate: tracking?.onTimeUpdate,
    onSeeked: tracking?.onSeeked,
  };

  const endCard =
    hasEnded && playback === "manual" ? (
      <div
        role="group"
        aria-label={playlistContent.ended}
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-[var(--space-3)] bg-[var(--video-scrim)]"
      >
        <span className="text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--video-ink)]">
          {playlistContent.ended}
        </span>
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-[var(--space-2)]">
          <Button variant="secondary" iconLeft="rotate-ccw" onClick={replay}>
            {transport.replay}
          </Button>
          {!isLast(safeIndex, items.length) && (
            <Button
              iconRight="chevron-right"
              onClick={() => goTo(nextIndex(safeIndex, items.length))}
            >
              {transport.next}
            </Button>
          )}
        </div>
      </div>
    ) : null;

  return (
    <section
      aria-label={playlistContent.regionLabel}
      className="flex flex-col gap-[var(--space-6)] lg:flex-row lg:items-start"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-3)]">
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-inset)]">
          {plan ? (
            <EditedClipStage
              items={items}
              index={safeIndex}
              plan={plan}
              videoRef={videoRef}
              title={current.title}
              onReady={handleLoadedData}
              {...media}
              onEnded={handleEnded}
            >
              {endCard}
            </EditedClipStage>
          ) : (
            <>
              <ClipVideo
                items={items}
                index={safeIndex}
                videoRef={videoRef}
                onReady={handleLoadedData}
                title={current.title}
                controls
                playsInline
                className="aspect-video w-full bg-[var(--surface-inset)]"
                {...media}
                onEnded={handleEnded}
              >
                {playlistContent.unsupported}
              </ClipVideo>
              {endCard}
            </>
          )}
        </div>

        <div className="flex items-center gap-[var(--space-3)]">
          <div className="flex items-center gap-[var(--space-1)]">
            <IconButton
              name="chevron-left"
              label={transport.previous}
              disabled={safeIndex === 0}
              onClick={() => goTo(prevIndex(safeIndex, items.length))}
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
              onClick={() => goTo(nextIndex(safeIndex, items.length))}
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
            {current.coachComment && (
              <CoachComment
                text={current.coachComment}
                className="mt-[var(--space-1)] text-[length:var(--fs-body-sm)]"
              />
            )}
            {current.teamNote && (
              <TeamNote
                text={current.teamNote}
                className="mt-[var(--space-2)] text-[length:var(--fs-body-sm)]"
              />
            )}
          </div>
        </div>

        {comments && (
          <div className="mt-[var(--space-3)] border-t border-[color:var(--border)] pt-[var(--space-4)]">
            <CommentThread
              clipId={current.id}
              shareToken={comments.shareToken}
            />
          </div>
        )}
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
                  onClick={() => goTo(itemIndex)}
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
