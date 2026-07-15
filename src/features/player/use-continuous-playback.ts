"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type VideoHTMLAttributes,
} from "react";

import type { PlayerController } from "./PlayerContext";
import { nextChapterIndex, planSeek } from "./playback-plan";
import { DEFAULT_PLAYBACK_RATE } from "./playback-rate";
import type { PlayerSource } from "./player-sources";

import { toGameTime, totalDurationS } from "@/lib/time-mapping";

/**
 * Event handlers the player spreads onto its single `<video>` element. Kept as a
 * named subset so the component wiring stays declarative and this hook owns all
 * of the playback logic.
 */
type VideoEventProps = Pick<
  VideoHTMLAttributes<HTMLVideoElement>,
  | "onTimeUpdate"
  | "onEnded"
  | "onLoadedMetadata"
  | "onPlay"
  | "onPause"
  | "onWaiting"
  | "onPlaying"
>;

export interface ContinuousPlayback {
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  /** The chapter currently loaded; its `src` goes on the `<video>` element. */
  readonly activeSource: PlayerSource;
  readonly videoProps: VideoEventProps;
  readonly controller: PlayerController;
}

/**
 * Drives one `<video>` element through N ordered chapter files as a single
 * continuous game timeline (ADR 0002, PRD 5.2).
 *
 * Playback stays on one element and swaps its `src` at each chapter boundary:
 * when a chapter ends we advance to the next and resume at its start, and a seek
 * that lands in another chapter loads that chapter, then applies the local
 * offset once its metadata is ready. The coach only ever manipulates global game
 * time; the `(chapter, local offset)` mapping is confined to this hook and the
 * pure {@link planSeek} helper.
 */
export function useContinuousPlayback(
  sources: readonly PlayerSource[],
): ContinuousPlayback {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const durationsS = useMemo(
    () => sources.map((source) => source.durationS),
    [sources],
  );
  const durationS = useMemo(() => totalDurationS(durationsS), [durationsS]);

  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [gameTimeS, setGameTimeS] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState<number>(
    DEFAULT_PLAYBACK_RATE,
  );

  // Local offset to apply to the next-loaded chapter, and whether to resume
  // playing once it is ready. Both are consumed in `onLoadedMetadata` after a
  // `src` swap, where the new chapter's duration is finally known.
  const pendingLocalOffsetRef = useRef<number | null>(null);
  const resumeAfterSwitchRef = useRef(false);
  // The scan speed to re-apply after a `src` swap: loading a new chapter resets
  // the element's `playbackRate` to 1, so `onLoadedMetadata` restores it.
  const playbackRateRef = useRef<number>(DEFAULT_PLAYBACK_RATE);

  const readGameTimeS = useCallback(() => {
    const video = videoRef.current;
    if (!video) return gameTimeS;
    const chapterDuration = durationsS[activeSourceIndex];
    const localOffsetS = Math.min(
      Math.max(video.currentTime, 0),
      chapterDuration,
    );
    return toGameTime(durationsS, {
      sourceIndex: activeSourceIndex,
      localOffsetS,
    });
  }, [durationsS, activeSourceIndex, gameTimeS]);

  const onTimeUpdate = useCallback(() => {
    setGameTimeS(readGameTimeS());
  }, [readGameTimeS]);

  const onEnded = useCallback(() => {
    const next = nextChapterIndex(sources.length, activeSourceIndex);
    if (next === null) {
      setIsPlaying(false);
      setGameTimeS(durationS);
      return;
    }
    // Continue the game seamlessly at the start of the following chapter.
    resumeAfterSwitchRef.current = true;
    pendingLocalOffsetRef.current = 0;
    setActiveSourceIndex(next);
  }, [sources.length, activeSourceIndex, durationS]);

  const onLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const pending = pendingLocalOffsetRef.current;
    if (pending !== null) {
      video.currentTime = Math.min(pending, durationsS[activeSourceIndex]);
      pendingLocalOffsetRef.current = null;
    }
    // A new chapter's `src` resets the rate to 1x; restore the coach's scan speed.
    video.playbackRate = playbackRateRef.current;
    setGameTimeS(readGameTimeS());

    if (resumeAfterSwitchRef.current) {
      resumeAfterSwitchRef.current = false;
      void video.play();
    }
  }, [durationsS, activeSourceIndex, readGameTimeS]);

  const seekTo = useCallback(
    (targetGameTimeS: number) => {
      const plan = planSeek(durationsS, activeSourceIndex, targetGameTimeS);
      const video = videoRef.current;

      if (plan.switchSource) {
        // Resume after the swap only if we were mid-play, so a paused scrub
        // across a chapter boundary stays paused.
        resumeAfterSwitchRef.current = video ? !video.paused : false;
        pendingLocalOffsetRef.current = plan.localOffsetS;
        setActiveSourceIndex(plan.sourceIndex);
        return;
      }

      if (video) video.currentTime = plan.localOffsetS;
      // Reflect the new position immediately; `timeupdate` may lag a paused seek.
      setGameTimeS(toGameTime(durationsS, plan));
    },
    [durationsS, activeSourceIndex],
  );

  const seekBy = useCallback(
    (deltaS: number) => {
      seekTo(readGameTimeS() + deltaS);
    },
    [seekTo, readGameTimeS],
  );

  const stepBy = useCallback(
    (deltaS: number) => {
      // Land on a still frame: pause first so a step never resumes playback.
      videoRef.current?.pause();
      seekBy(deltaS);
    },
    [seekBy],
  );

  const setPlaybackRate = useCallback((rate: number) => {
    playbackRateRef.current = rate;
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);

  const play = useCallback(() => {
    void videoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  // Free the decoder and any buffered chapter bytes promptly when the player
  // leaves the page, rather than waiting for the element to be garbage
  // collected: clear the source and `load()` to abort the in-flight fetch and
  // release memory. Chapter-to-chapter release already happens when React swaps
  // the `src` attribute; this covers navigating away from the watch page.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (!video) return;
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  const controller = useMemo<PlayerController>(
    () => ({
      gameTimeS,
      durationS,
      isPlaying,
      isBuffering,
      playbackRate,
      activeSourceIndex,
      getGameTimeS: readGameTimeS,
      seekTo,
      seekBy,
      stepBy,
      play,
      pause,
      togglePlay,
      setPlaybackRate,
    }),
    [
      gameTimeS,
      durationS,
      isPlaying,
      isBuffering,
      playbackRate,
      activeSourceIndex,
      readGameTimeS,
      seekTo,
      seekBy,
      stepBy,
      play,
      pause,
      togglePlay,
      setPlaybackRate,
    ],
  );

  const videoProps = useMemo<VideoEventProps>(
    () => ({
      onTimeUpdate,
      onEnded,
      onLoadedMetadata,
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onWaiting: () => setIsBuffering(true),
      onPlaying: () => setIsBuffering(false),
    }),
    [onTimeUpdate, onEnded, onLoadedMetadata],
  );

  return {
    videoRef,
    activeSource: sources[activeSourceIndex],
    videoProps,
    controller,
  };
}
