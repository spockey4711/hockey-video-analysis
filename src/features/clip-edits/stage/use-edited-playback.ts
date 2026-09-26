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
 * A freezing marker (D6) holds the picture: the frame that steps over its
 * moment stops the video for the marker's hold time, then the clip plays on by
 * itself. The clip still counts as playing meanwhile - the transport shows
 * pause, and the caller hears no `pause` and `play` for the hold - so pausing
 * during a hold keeps the picture and its marker where they are, and play goes
 * on past the marker. Callers that play or pause from their own buttons go
 * through {@link EditedPlayback.togglePlay} and {@link EditedPlayback.pause} for
 * that reason: the element alone reads as paused during a hold.
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
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { ClipMark } from "../edit";
import { editStateAt, freezeCrossed, type PlaybackPlan } from "../playback";

import type { VideoEvent } from "@/features/share/views/client";
import { frameDurationS } from "@/lib/frame-step";

/** A time range in clip-file seconds, `startS` before `endS`. */
export interface FileRange {
  readonly startS: number;
  readonly endS: number;
}

/** A value the player changes on its own, readable without re-rendering the player. */
export interface LiveValue<T> {
  readonly get: () => T;
  readonly subscribe: (onChange: () => void) => () => void;
}

/** The playhead in clip-file seconds. */
export type Playhead = LiveValue<number>;

interface LiveStore<T> extends LiveValue<T> {
  readonly set: (value: T) => void;
}

function createLiveValue<T>(initial: T): LiveStore<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(value) {
      if (value === current) return;
      current = value;
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
  /** The id of the freezing marker the picture holds for, or null. */
  readonly held: LiveValue<string | null>;
  /** The stretch scrubbing and frame steps cover. */
  readonly range: FileRange;
  readonly togglePlay: () => void;
  /** Pause, also during a marker's hold, which then keeps its picture. */
  readonly pause: () => void;
  /** Move the playhead, clamped to {@link EditedPlayback.range}. */
  readonly seek: (fileS: number) => void;
  /** Pause and move the playhead by `deltaS`, clamped like {@link seek}. */
  readonly stepBy: (deltaS: number) => void;
  /** Seconds one frame of the clip lasts, the distance of a single-frame step. */
  readonly frameS: number;
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
  /**
   * The clip's frames per second (its chapter's, `src/lib/frame-step`); unknown
   * or absent, a frame step assumes the default rate.
   */
  readonly frameRate?: number | null;
  /** The clip started playing; not called again when it plays on after a marker's hold. */
  readonly onPlay?: (event: VideoEvent) => void;
  /** The clip stopped playing; a marker's hold is not a stop. */
  readonly onPause?: (event: VideoEvent) => void;
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
/**
 * How far before the playhead a run starts looking for freezing markers, so a
 * marker right on the frame play starts from still holds the picture.
 */
const START_LOOKBACK_S = 0.001;

/** The element's per-frame callback, not in every browser or type library. */
type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: { mediaTime: number }) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/** A freezing marker holding the picture. */
interface Hold {
  readonly mark: ClipMark;
  readonly video: HTMLVideoElement;
  /** Plays on when it fires; null once the viewer paused during the hold. */
  readonly timer: ReturnType<typeof setTimeout> | null;
}

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
  const [playhead] = useState(() => createLiveValue(0));
  const [held] = useState(() => createLiveValue<string | null>(null));
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const isPlaying = playingKey === options.clipKey;
  const [isSlow, setIsSlow] = useState(false);
  const range = options.range ?? { startS: plan.inS, endS: plan.outS };

  // The frame loop outlives renders; it reads the latest plan and callbacks.
  // Synced in a layout effect, so it is current before the effect that cues a
  // clip loaded ahead the moment it comes up.
  const latest = useRef({ ...options, plan, range });
  useLayoutEffect(() => {
    latest.current = { ...options, plan, range };
  });
  // Set once the current run reached the out point, so it ends only once.
  const endedRef = useRef(false);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const holdRef = useRef<Hold | null>(null);
  // Where the last frame of the current run was, to find markers stepped over.
  const lastFrameRef = useRef(Number.NEGATIVE_INFINITY);
  // Where the next run plays on from after a hold, past its marker.
  const resumeFromRef = useRef<number | null>(null);
  // Whether the caller was last told the clip plays, and for which clip.
  const reportedRef = useRef({ clipKey: "", playing: false });

  /** Tell the caller the clip plays or stopped, once per change. */
  const report = useCallback((video: HTMLVideoElement, playing: boolean) => {
    const { clipKey, onPlay, onPause } = latest.current;
    const reported = reportedRef.current;
    const was = reported.clipKey === clipKey && reported.playing;
    if (was === playing) return;
    reportedRef.current = { clipKey, playing };
    (playing ? onPlay : onPause)?.({ currentTarget: video });
  }, []);

  /** The clip stopped: no longer playing, for the transport and the caller. */
  const markStopped = useCallback(
    (video: HTMLVideoElement) => {
      stopLoopRef.current?.();
      setPlayingKey(null);
      report(video, false);
    },
    [report],
  );

  /** End the hold, if any, without playing on; returns it. */
  const dropHold = useCallback((): Hold | null => {
    const hold = holdRef.current;
    if (!hold) return null;
    if (hold.timer !== null) clearTimeout(hold.timer);
    holdRef.current = null;
    held.set(null);
    return hold;
  }, [held]);

  const reachEnd = useCallback(
    (video: HTMLVideoElement) => {
      if (endedRef.current) return;
      endedRef.current = true;
      dropHold();
      video.pause();
      markStopped(video);
      latest.current.onEnded?.({ currentTarget: video });
    },
    [dropHold, markStopped],
  );

  /** A hold's time is up: play on past its marker, or end on one at the out point. */
  const release = useCallback(() => {
    const hold = holdRef.current;
    if (!hold || hold.timer === null) return;
    dropHold();
    const { video, mark } = hold;
    if (video !== videoRef.current) return;
    if (mark.atS >= latest.current.plan.outS - END_TOLERANCE_S) {
      reachEnd(video);
      return;
    }
    resumeFromRef.current = mark.atS;
    Promise.resolve(video.play()).catch(() => markStopped(video));
  }, [videoRef, dropHold, reachEnd, markStopped]);

  /** Hold the picture on `mark`: stop the video, still counting as playing. */
  const startHold = useCallback(
    (video: HTMLVideoElement, mark: ClipMark) => {
      holdRef.current = {
        mark,
        video,
        timer: setTimeout(release, mark.holdS * 1000),
      };
      held.set(mark.id);
      video.pause();
    },
    [held, release],
  );

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
      const { plan: current } = latest.current;
      const mark = freezeCrossed(current, lastFrameRef.current, fileS);
      lastFrameRef.current = fileS;
      if (mark) {
        startHold(video, mark);
        return false;
      }
      const state = editStateAt(current, fileS);
      if (state.beforeIn) {
        video.currentTime = current.inS;
      } else if (state.ended) {
        reachEnd(video);
        return false;
      }
      applyRate(video, state.rate);
      return true;
    },
    [videoRef, playhead, startHold, reachEnd, applyRate],
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
  // A hold belongs to the clip it froze; another clip coming up ends it.
  useEffect(() => () => void dropHold(), [options.clipKey, dropHold]);
  // Markers switched off (or the held one deleted) let a held picture go on.
  const { marks } = plan;
  useEffect(() => {
    const hold = holdRef.current;
    if (!hold || marks.some((mark) => mark.id === hold.mark.id)) return;
    if (hold.timer === null) dropHold();
    else release();
  }, [marks, dropHold, release]);

  const cue = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused && outsidePlan(latest.current.plan, video.currentTime)) {
      video.currentTime = latest.current.plan.inS;
    }
    playhead.set(video.currentTime);
  }, [videoRef, playhead]);

  const pause = useCallback(() => {
    const hold = holdRef.current;
    if (hold && hold.timer !== null) {
      // Keep the held picture and its marker up, but stop the clock on it.
      clearTimeout(hold.timer);
      holdRef.current = { ...hold, timer: null };
      markStopped(hold.video);
      return;
    }
    videoRef.current?.pause();
  }, [videoRef, markStopped]);

  const seek = useCallback(
    (fileS: number) => {
      const video = videoRef.current;
      if (!video) return;
      const hold = dropHold();
      if (hold && hold.timer !== null) markStopped(video);
      resumeFromRef.current = null;
      const target = clamp(fileS, latest.current.range);
      endedRef.current = false;
      lastFrameRef.current = target - START_LOOKBACK_S;
      video.currentTime = target;
      playhead.set(target);
    },
    [videoRef, playhead, dropHold, markStopped],
  );

  const stepBy = useCallback(
    (deltaS: number) => {
      const video = videoRef.current;
      if (!video) return;
      pause();
      seek(video.currentTime + deltaS);
    },
    [videoRef, pause, seek],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (holdRef.current?.timer != null) pause();
    else if (video.paused) void video.play();
    else video.pause();
  }, [videoRef, pause]);

  const handlers: EditedVideoHandlers = {
    onLoadedMetadata: cue,
    onPlay({ currentTarget: video }) {
      const { plan: current } = latest.current;
      // Play on past a marker after its hold, or past the one paused on.
      const hold = dropHold();
      let fromS =
        resumeFromRef.current ??
        hold?.mark.atS ??
        video.currentTime - START_LOOKBACK_S;
      resumeFromRef.current = null;
      if (outsidePlan(current, video.currentTime)) {
        video.currentTime = current.inS;
        fromS = Number.NEGATIVE_INFINITY;
      }
      lastFrameRef.current = fromS;
      endedRef.current = false;
      applyRate(video, editStateAt(current, video.currentTime).rate);
      setPlayingKey(latest.current.clipKey);
      report(video, true);
      startLoop(video);
    },
    onPause({ currentTarget: video }) {
      // The hold stopped the video on purpose; the clip still plays.
      const hold = holdRef.current;
      if (hold && hold.timer !== null && hold.video === video) return;
      markStopped(video);
    },
    onSeeked({ currentTarget: video }) {
      playhead.set(video.currentTime);
      lastFrameRef.current = video.currentTime - START_LOOKBACK_S;
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
    held,
    range,
    togglePlay,
    pause,
    seek,
    stepBy,
    frameS: frameDurationS(options.frameRate),
    cue,
    handlers,
  };
}
