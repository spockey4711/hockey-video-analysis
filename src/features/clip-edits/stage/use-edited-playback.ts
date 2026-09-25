"use client";

/**
 * Plays a clip file through its {@link PlaybackPlan} (ADR 0011): the player
 * starts at the in point, stops at the out point and never shows what lies
 * outside while it plays. The plan is applied on every frame the browser
 * presents (`requestVideoFrameCallback`, where the browser has it, else every
 * animation frame), so a stop lands within about a frame of the out point. The
 * same frames set the plan's playback rate, so slow motion starts and ends
 * within about a frame of its range; the player says while it plays slow, as
 * slow motion plays muted (D5).
 *
 * The element never fires `ended` at an out point before the end of the file,
 * so reaching it pauses the clip and calls `onEnded` itself; a native `ended`
 * at the end of the file goes the same way, once. Play from outside the in and
 * out point starts over at the in point, as a finished native clip does.
 *
 * While paused, the playhead may sit anywhere in the file (the editor scrubs
 * past the in and out point to set new ones); only playback keeps to them.
 */
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { editStateAt, type PlaybackPlan } from "../playback";

import type { VideoEvent } from "@/features/share/views/client";

/** A time range in clip-file seconds, `startS` before `endS`. */
export interface FileRange {
  readonly startS: number;
  readonly endS: number;
}

/** The playhead in clip-file seconds, readable without re-rendering the player. */
export interface Playhead {
  readonly get: () => number;
  readonly subscribe: (onChange: () => void) => () => void;
}

interface PlayheadStore extends Playhead {
  readonly set: (fileS: number) => void;
}

function createPlayhead(): PlayheadStore {
  let current = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(fileS) {
      if (fileS === current) return;
      current = fileS;
      for (const listener of listeners) listener();
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
}

/** Media handlers the stage puts on the current `<video>`. */
export interface EditedVideoHandlers {
  readonly onLoadedMetadata: (event: VideoEvent) => void;
  readonly onPlay: (event: VideoEvent) => void;
  readonly onPause: (event: VideoEvent) => void;
  readonly onSeeked: (event: VideoEvent) => void;
  readonly onTimeUpdate: (event: VideoEvent) => void;
  readonly onEnded: (event: VideoEvent) => void;
}

/** The player's side of an edited clip: its state and the controls to drive it. */
export interface EditedPlayback {
  readonly isPlaying: boolean;
  /** The clip plays in slow motion now, which plays muted (D5). */
  readonly isSlow: boolean;
  readonly playhead: Playhead;
  /** The stretch scrubbing and frame steps cover. */
  readonly range: FileRange;
  readonly togglePlay: () => void;
  readonly pause: () => void;
  /** Move the playhead, clamped to {@link EditedPlayback.range}. */
  readonly seek: (fileS: number) => void;
  /** Pause and move the playhead by `deltaS`, clamped like {@link seek}. */
  readonly stepBy: (deltaS: number) => void;
  /** Put a clip that just came up on its in point, unless it plays already. */
  readonly cue: () => void;
  readonly handlers: EditedVideoHandlers;
}

export interface EditedPlaybackOptions {
  /**
   * Which clip is up. A clip taken off screen while it plays reports no
   * `pause`, so the player reads as playing only while the clip that started
   * is still the one up.
   */
  readonly clipKey: string;
  /** The stretch to scrub over; defaults to the plan's in and out point. */
  readonly range?: FileRange;
  /** The player reached the out point (or the end of the file) and stopped. */
  readonly onEnded?: (event: VideoEvent) => void;
}

/** Positions this close to the in point count as on it (a seek lands a hair off). */
const CUE_TOLERANCE_S = 0.001;
/**
 * Positions this close to the out point count as at the end: a seek to the out
 * point lands on the frame just before it, and play from there would stop
 * again at once instead of starting over.
 */
const END_TOLERANCE_S = 0.05;

/** The element's per-frame callback, not in every browser or type library. */
type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: { mediaTime: number }) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

function clamp(value: number, { startS, endS }: FileRange): number {
  return Math.min(Math.max(value, startS), endS);
}

function outsidePlan(plan: PlaybackPlan, fileS: number): boolean {
  return (
    fileS < plan.inS - CUE_TOLERANCE_S || fileS >= plan.outS - END_TOLERANCE_S
  );
}

export function useEditedPlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  plan: PlaybackPlan,
  options: EditedPlaybackOptions,
): EditedPlayback {
  const [playhead] = useState(createPlayhead);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const isPlaying = playingKey === options.clipKey;
  const [isSlow, setIsSlow] = useState(false);
  const range = options.range ?? { startS: plan.inS, endS: plan.outS };

  // The frame loop outlives renders; it reads the latest plan and callbacks.
  const latest = useRef({
    plan,
    range,
    clipKey: options.clipKey,
    onEnded: options.onEnded,
  });
  useEffect(() => {
    latest.current = {
      plan,
      range,
      clipKey: options.clipKey,
      onEnded: options.onEnded,
    };
  });
  // Set once the current run reached the out point, so it ends only once.
  const endedRef = useRef(false);
  const stopLoopRef = useRef<(() => void) | null>(null);

  const reachEnd = useCallback((video: HTMLVideoElement) => {
    if (endedRef.current) return;
    endedRef.current = true;
    video.pause();
    latest.current.onEnded?.({ currentTarget: video });
  }, []);

  /** Play at `rate`: full speed, or slow motion, which plays muted. */
  const applyRate = useCallback((video: HTMLVideoElement, rate: number) => {
    if (video.playbackRate !== rate) video.playbackRate = rate;
    setIsSlow(rate < 1);
  }, []);

  /** Apply the plan at the frame showing `fileS`; false once playback stopped. */
  const applyFrame = useCallback(
    (video: HTMLVideoElement, fileS: number): boolean => {
      // A clip taken off screen keeps no say over the playhead.
      if (video !== videoRef.current) return false;
      // A frame from before a seek still in flight says nothing about now.
      if (video.seeking) return true;
      playhead.set(fileS);
      if (video.paused) return false;
      const state = editStateAt(latest.current.plan, fileS);
      if (state.beforeIn) {
        video.currentTime = latest.current.plan.inS;
      } else if (state.ended) {
        reachEnd(video);
        return false;
      }
      applyRate(video, state.rate);
      return true;
    },
    [videoRef, playhead, reachEnd, applyRate],
  );

  const startLoop = useCallback(
    (video: FrameCallbackVideo) => {
      stopLoopRef.current?.();
      let stopped = false;
      if (video.requestVideoFrameCallback && video.cancelVideoFrameCallback) {
        const request = video.requestVideoFrameCallback.bind(video);
        const tick = (_now: number, { mediaTime }: { mediaTime: number }) => {
          if (!stopped && applyFrame(video, mediaTime)) handle = request(tick);
        };
        let handle = request(tick);
        const cancel = video.cancelVideoFrameCallback.bind(video);
        stopLoopRef.current = () => {
          stopped = true;
          cancel(handle);
        };
      } else {
        const tick = () => {
          if (!stopped && applyFrame(video, video.currentTime)) {
            handle = requestAnimationFrame(tick);
          }
        };
        let handle = requestAnimationFrame(tick);
        stopLoopRef.current = () => {
          stopped = true;
          cancelAnimationFrame(handle);
        };
      }
    },
    [applyFrame],
  );

  useEffect(() => () => stopLoopRef.current?.(), []);

  const cue = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused && outsidePlan(latest.current.plan, video.currentTime)) {
      video.currentTime = latest.current.plan.inS;
    }
    playhead.set(video.currentTime);
  }, [videoRef, playhead]);

  const seek = useCallback(
    (fileS: number) => {
      const video = videoRef.current;
      if (!video) return;
      const target = clamp(fileS, latest.current.range);
      endedRef.current = false;
      video.currentTime = target;
      playhead.set(target);
    },
    [videoRef, playhead],
  );

  const stepBy = useCallback(
    (deltaS: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      seek(video.currentTime + deltaS);
    },
    [videoRef, seek],
  );

  const pause = useCallback(() => videoRef.current?.pause(), [videoRef]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, [videoRef]);

  const handlers: EditedVideoHandlers = {
    onLoadedMetadata: cue,
    onPlay({ currentTarget: video }) {
      if (outsidePlan(latest.current.plan, video.currentTime)) {
        video.currentTime = latest.current.plan.inS;
      }
      endedRef.current = false;
      applyRate(
        video,
        editStateAt(latest.current.plan, video.currentTime).rate,
      );
      setPlayingKey(latest.current.clipKey);
      startLoop(video);
    },
    onPause() {
      stopLoopRef.current?.();
      setPlayingKey(null);
    },
    onSeeked({ currentTarget: video }) {
      playhead.set(video.currentTime);
    },
    onTimeUpdate({ currentTarget: video }) {
      if (video.paused) playhead.set(video.currentTime);
    },
    onEnded({ currentTarget: video }) {
      reachEnd(video);
    },
  };

  return {
    isPlaying,
    isSlow,
    playhead,
    range,
    togglePlay,
    pause,
    seek,
    stepBy,
    cue,
    handlers,
  };
}
