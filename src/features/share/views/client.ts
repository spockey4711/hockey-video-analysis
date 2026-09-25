/**
 * Browser side of view counting on the collection share link (ADR 0009). The
 * players spread {@link viewTracking}'s handlers onto their `<video>`; each
 * element gets its own {@link ViewTracker}, and every event it yields is sent
 * fire-and-forget. Tracking never touches playback: nothing here awaits, every
 * failure is swallowed, and nothing is stored on the viewer's device.
 *
 * A clip played through an edit (ADR 0011) only shows the stretch between its
 * in and out point. Given that {@link ViewWindow}, the handlers report
 * positions from the in point and the stretch's length as the clip's length,
 * so a full view means most of what the viewer was shown; the player reports
 * reaching the out point as `ended` itself, as the element never fires it
 * there.
 */
import {
  VIEW_EVENTS_PATH,
  type ViewEventInput,
  type ViewEventType,
} from "./events";
import { createViewTracker, type ViewTracker } from "./tracker";

/** Which link and clip a player is showing, so its events can be reported. */
export interface ViewTrackingTarget {
  /** The collection's share token, already in the viewer's URL. */
  readonly shareToken: string;
  readonly clipId: string;
  /** The stretch of the clip file the viewer is shown; absent, the whole file. */
  readonly window?: ViewWindow;
}

/** The in and out point of an edited clip, in clip-file seconds. */
export interface ViewWindow {
  readonly inS: number;
  readonly outS: number;
}

/**
 * The part of a media event the handlers read. A React event fits, and a
 * player reaching an out point passes `{ currentTarget: video }` itself.
 */
export interface VideoEvent {
  readonly currentTarget: HTMLVideoElement;
}

/** Media-event handlers for one `<video>` showing {@link ViewTrackingTarget}'s clip. */
export interface ViewTrackingHandlers {
  readonly onPlay: (event: VideoEvent) => void;
  readonly onTimeUpdate: (event: VideoEvent) => void;
  readonly onSeeked: (event: VideoEvent) => void;
  readonly onEnded: (event: VideoEvent) => void;
}

/**
 * Send one event without waiting for an answer. `sendBeacon` is made for this:
 * the browser queues the request and delivers it even while the page unloads.
 * Where it is missing or refuses, a `keepalive` fetch does the same job.
 */
export function sendViewEvent(event: ViewEventInput): void {
  try {
    const body = JSON.stringify(event);
    if (
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(
        VIEW_EVENTS_PATH,
        new Blob([body], { type: "application/json" }),
      )
    ) {
      return;
    }
    fetch(VIEW_EVENTS_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Counting is best effort; a failure must never reach the player.
  }
}

// One tracker per element. A player gives each visit to a clip its own
// `<video>` (and the presentation mode each opening), so a fresh element is a
// fresh load and a new `click`; entries go away with their elements. A clip
// loaded ahead sits in its element with no handlers until it comes up, so it
// reaches its tracker only once the viewer plays it (see `ClipVideo`).
const trackers = new WeakMap<HTMLVideoElement, ViewTracker>();

function trackerFor(video: HTMLVideoElement): ViewTracker {
  let tracker = trackers.get(video);
  if (!tracker) {
    tracker = createViewTracker();
    trackers.set(video, tracker);
  }
  return tracker;
}

/**
 * Handlers that report `target`'s clip, or `undefined` when there is nothing to
 * track (the team and player links pass no target).
 */
export function viewTracking(
  target: ViewTrackingTarget | undefined,
  send: (event: ViewEventInput) => void = sendViewEvent,
): ViewTrackingHandlers | undefined {
  if (!target) return undefined;
  const { shareToken, clipId, window: shown } = target;

  function report(type: ViewEventType | null) {
    if (type) send({ token: shareToken, clipId, type });
  }

  // Where the viewer is and how long the clip is, measured in the window.
  const length = (video: HTMLVideoElement) =>
    shown ? shown.outS - shown.inS : video.duration;
  const position = (video: HTMLVideoElement) =>
    shown
      ? Math.min(Math.max(video.currentTime - shown.inS, 0), length(video))
      : video.currentTime;

  return {
    onPlay({ currentTarget: video }) {
      report(trackerFor(video).play(position(video), length(video)));
    },
    onTimeUpdate({ currentTarget: video }) {
      report(trackerFor(video).progress(position(video), length(video)));
    },
    onSeeked({ currentTarget: video }) {
      report(
        trackerFor(video).seeked(position(video), length(video), video.paused),
      );
    },
    onEnded({ currentTarget: video }) {
      report(trackerFor(video).ended(length(video)));
    },
  };
}
