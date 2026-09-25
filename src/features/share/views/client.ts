/**
 * Browser side of view counting on the collection share link (ADR 0009). The
 * players spread {@link viewTracking}'s handlers onto their `<video>`; each
 * element gets its own {@link ViewTracker}, and every event it yields is sent
 * fire-and-forget. Tracking never touches playback: nothing here awaits, every
 * failure is swallowed, and nothing is stored on the viewer's device.
 */
import type { SyntheticEvent } from "react";

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
}

type VideoEvent = SyntheticEvent<HTMLVideoElement>;

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
  const { shareToken, clipId } = target;

  function report(type: ViewEventType | null) {
    if (type) send({ token: shareToken, clipId, type });
  }

  return {
    onPlay({ currentTarget: video }) {
      report(trackerFor(video).play(video.currentTime, video.duration));
    },
    onTimeUpdate({ currentTarget: video }) {
      report(trackerFor(video).progress(video.currentTime, video.duration));
    },
    onSeeked({ currentTarget: video }) {
      report(
        trackerFor(video).seeked(
          video.currentTime,
          video.duration,
          video.paused,
        ),
      );
    },
    onEnded({ currentTarget: video }) {
      report(trackerFor(video).ended(video.duration));
    },
  };
}
