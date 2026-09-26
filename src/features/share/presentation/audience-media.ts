/**
 * How the audience window keeps its clip in step with the presenter's (ADR
 * 0015). Both windows play the same file, each on its own clock; the
 * presenter's is the one that counts. The audience plays and pauses when the
 * presenter does, and seeks only when it drifts off by more than a projector
 * audience could notice, so the picture never stutters from constant small
 * corrections. A marker's hold on the presenter's side is a still picture the
 * audience mirrors: it pauses on the presenter's held frame (the stage only
 * holds on a marker it plays across, and a seek onto the frame would skip
 * it) and plays on when the presenter does. A hold only the audience reached
 * resolves by itself, a marker apart from the presenter's.
 */
import type { AudienceMedia } from "./audience-protocol";

/** How far a playing clip may drift before the audience seeks, in seconds. */
export const DRIFT_TOLERANCE_S = 0.35;

/** How far a still picture may be off the presenter's, about a frame. */
export const STILL_TOLERANCE_S = 0.02;

/** The audience's own clip, as its player reports it. */
export interface LocalMedia {
  /** Whether it plays, as its transport would show it. */
  readonly playing: boolean;
  /** Whether a marker holds its picture still while it plays. */
  readonly held: boolean;
  /** Where it is on the file's clock, in seconds. */
  readonly time: number;
}

/** What the audience does to its clip to follow the presenter's. */
export interface MediaCorrection {
  /** Seek here first, or `null` to stay put. */
  readonly seekTo: number | null;
  readonly play: boolean;
  readonly pause: boolean;
}

const NOTHING: MediaCorrection = { seekTo: null, play: false, pause: false };

/**
 * Where the presenter's clip is `now` (milliseconds since the epoch): where
 * it was read, moved on by the time since at its rate while it runs.
 */
export function presenterTimeAt(
  media: AudienceMedia,
  now: number,
): number | null {
  if (media.time === null) return null;
  if (!media.playing || media.held) return media.time;
  const elapsedS = Math.max(now - media.at, 0) / 1000;
  return media.time + elapsedS * media.rate;
}

/** What the audience's clip `local` must do to follow `target` at `now`. */
export function mediaCorrection(
  target: AudienceMedia,
  now: number,
  local: LocalMedia,
): MediaCorrection {
  const time = presenterTimeAt(target, now);
  if (time === null) return NOTHING;
  const off = Math.abs(local.time - time);

  if (!target.playing || target.held) {
    return {
      seekTo: off > STILL_TOLERANCE_S ? time : null,
      play: false,
      pause: local.playing,
    };
  }
  if (!local.playing) {
    return {
      seekTo: off > STILL_TOLERANCE_S ? time : null,
      play: true,
      pause: false,
    };
  }
  // Both play: the audience's own hold resolves by itself, a marker apart.
  if (local.held) return NOTHING;
  return {
    seekTo: off > DRIFT_TOLERANCE_S ? time : null,
    play: false,
    pause: false,
  };
}

/** The part of a video element the presenter reads. */
export interface VideoLike {
  readonly paused: boolean;
  readonly currentTime: number;
  readonly playbackRate: number;
}

/** The presenter's entry on screen, as its player reports it. */
export interface PresenterEntryPlayback {
  readonly kind: "clip" | "scene";
  /** Whether the clip plays through a plan, on the edited-clip stage. */
  readonly staged: boolean;
  /** Whether it plays, as its transport shows it. */
  readonly isPlaying: boolean;
}

/**
 * How far the frame on screen may lie from the element's clock and still be
 * taken for it: a few frames. Further off, the frame is from before a seek.
 */
const SHOWN_FRAME_WINDOW_S = 0.1;

/**
 * How the presenter's entry plays at `now`, for the audience. The video
 * element alone reads as paused while a marker holds the picture, so a staged
 * clip counts as playing by its transport, and as held while its element
 * stands still.
 *
 * A picture that stands still is sent as the frame on screen, `shownS` (from
 * `requestVideoFrameCallback`), where known: after a pause the element's clock
 * can lag the frame it shows by one, and the audience seeks to the time it is
 * given, so it would show the frame before the presenter's.
 */
export function presenterMedia(
  entry: PresenterEntryPlayback,
  video: VideoLike | null,
  now: number,
  shownS: number | null = null,
): AudienceMedia {
  if (entry.kind === "scene") {
    return {
      playing: entry.isPlaying,
      held: false,
      time: null,
      rate: 1,
      at: now,
    };
  }
  if (!video) return { playing: false, held: false, time: 0, rate: 1, at: now };
  const playing = entry.staged ? entry.isPlaying : !video.paused;
  const still =
    video.paused &&
    shownS !== null &&
    Math.abs(shownS - video.currentTime) <= SHOWN_FRAME_WINDOW_S;
  return {
    playing,
    held: entry.staged && playing && video.paused,
    time: still ? shownS : video.currentTime,
    rate: video.playbackRate,
    at: now,
  };
}
