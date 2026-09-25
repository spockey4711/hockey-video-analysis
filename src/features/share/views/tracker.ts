/**
 * Turns one `<video>` element's media events into view events (ADR 0009). Pure
 * and DOM-free, so the counting rules are unit-tested; {@link viewTracking}
 * wires it to a real element.
 *
 * One tracker follows one loaded clip. It counts:
 *
 * - `click` the first time the viewer starts it;
 * - `full_view` once a run has actually played {@link FULL_VIEW_SHARE} of the
 *   clip's length (skipping ahead adds no played time, pausing loses none);
 * - `replay` when the viewer starts it again after it ended or after a full
 *   view - with the replay button, the native play button on a finished clip,
 *   or by seeking back and playing. A replay begins a new run that can earn
 *   another full view.
 */
import { FULL_VIEW_SHARE, type ViewEventType } from "./events";

/**
 * The largest jump between two `timeupdate` positions still counted as played
 * time. Browsers report about every 250 ms, so a bigger forward jump is a seek.
 */
const MAX_PLAYED_STEP_S = 1.5;

export interface ViewTracker {
  /** The element fired `play` at `position` seconds of a `duration`-second clip. */
  play(position: number, duration: number): ViewEventType | null;
  /** The element fired `timeupdate`. */
  progress(position: number, duration: number): ViewEventType | null;
  /** The element fired `seeked`; `paused` is its state at that moment. */
  seeked(
    position: number,
    duration: number,
    paused: boolean,
  ): ViewEventType | null;
  /** The element fired `ended`. */
  ended(duration: number): ViewEventType | null;
}

function hasLength(duration: number): boolean {
  return Number.isFinite(duration) && duration > 0;
}

/** Whether `position` is before the stretch that completes a full view. */
function isBeforeTheEnd(position: number, duration: number): boolean {
  return hasLength(duration) && position < duration * FULL_VIEW_SHARE;
}

export function createViewTracker(): ViewTracker {
  let started = false;
  // Seconds actually played in the current run, and where the last report was.
  let played = 0;
  let lastPosition = 0;
  // The current run has earned its full view / has reached the end.
  let completed = false;
  let atEnd = false;

  function addPlayed(position: number) {
    const step = position - lastPosition;
    if (step > 0 && step <= MAX_PLAYED_STEP_S) played += step;
    lastPosition = position;
  }

  function completeIfPlayed(duration: number): ViewEventType | null {
    if (completed || !hasLength(duration)) return null;
    if (played < duration * FULL_VIEW_SHARE) return null;
    completed = true;
    return "full_view";
  }

  /** A replay if the run is over and playback restarts before the end. */
  function replayFrom(
    position: number,
    duration: number,
  ): ViewEventType | null {
    if (!(completed || atEnd) || !isBeforeTheEnd(position, duration)) {
      return null;
    }
    played = 0;
    completed = false;
    atEnd = false;
    return "replay";
  }

  return {
    play(position, duration) {
      lastPosition = position;
      if (!started) {
        started = true;
        return "click";
      }
      return replayFrom(position, duration);
    },
    progress(position, duration) {
      if (!started) {
        lastPosition = position;
        return null;
      }
      addPlayed(position);
      return completeIfPlayed(duration);
    },
    seeked(position, duration, paused) {
      lastPosition = position;
      // A paused seek only moves the playhead; the next play decides.
      return started && !paused ? replayFrom(position, duration) : null;
    },
    ended(duration) {
      if (!started) return null;
      // The last `timeupdate` lands a little before the end; count the rest.
      if (hasLength(duration)) addPlayed(duration);
      atEnd = true;
      return completeIfPlayed(duration);
    },
  };
}
