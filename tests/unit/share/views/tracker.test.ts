import { describe, expect, it } from "vitest";

import {
  createViewTracker,
  type ViewTracker,
} from "@/features/share/views/tracker";

const DURATION = 10;

/** Report `timeupdate`s every 0.25 s from `from` to `to`, collecting events. */
function playThrough(tracker: ViewTracker, from: number, to: number) {
  const events = [];
  for (let t = from + 0.25; t <= to + 1e-9; t += 0.25) {
    events.push(tracker.progress(t, DURATION));
  }
  return events.filter((event) => event !== null);
}

describe("createViewTracker", () => {
  it("counts a click the first time the clip starts, and only then", () => {
    const tracker = createViewTracker();
    expect(tracker.play(0, DURATION)).toBe("click");
    tracker.progress(0.25, DURATION);
    expect(tracker.play(0.25, DURATION)).toBeNull(); // resume after a pause
  });

  it("counts nothing before the viewer starts the clip", () => {
    const tracker = createViewTracker();
    expect(tracker.progress(0, DURATION)).toBeNull();
    expect(tracker.seeked(9.5, DURATION, true)).toBeNull();
    expect(tracker.ended(DURATION)).toBeNull();
  });

  it("counts a full view once 90 % has been played", () => {
    const tracker = createViewTracker();
    tracker.play(0, DURATION);
    expect(playThrough(tracker, 0, 8.75)).toEqual([]);
    expect(tracker.progress(9, DURATION)).toBe("full_view");
    // Playing on to the end does not count it twice.
    expect(playThrough(tracker, 9, DURATION)).toEqual([]);
    expect(tracker.ended(DURATION)).toBeNull();
  });

  it("keeps played time across a pause", () => {
    const tracker = createViewTracker();
    tracker.play(0, DURATION);
    playThrough(tracker, 0, 5);
    expect(tracker.play(5, DURATION)).toBeNull();
    expect(playThrough(tracker, 5, 9)).toEqual(["full_view"]);
  });

  it("does not count skipping ahead as a full view", () => {
    const tracker = createViewTracker();
    tracker.play(0, DURATION);
    playThrough(tracker, 0, 1);
    tracker.seeked(9.5, DURATION, false);
    expect(playThrough(tracker, 9.5, DURATION)).toEqual([]);
    expect(tracker.ended(DURATION)).toBeNull();
  });

  it("counts the stretch after the last timeupdate when the clip ends", () => {
    const tracker = createViewTracker();
    tracker.play(0, DURATION);
    playThrough(tracker, 0, 8.75);
    expect(tracker.ended(DURATION)).toBe("full_view");
  });

  it("never counts a full view without a known duration", () => {
    const tracker = createViewTracker();
    tracker.play(0, Number.NaN);
    tracker.progress(0.25, Number.NaN);
    expect(tracker.ended(Number.NaN)).toBeNull();
  });

  it("counts a replay when a finished clip is played from the start", () => {
    const tracker = createViewTracker();
    tracker.play(0, DURATION);
    playThrough(tracker, 0, DURATION);
    tracker.ended(DURATION);
    // The replay button: seek to 0 while paused, then play.
    expect(tracker.seeked(0, DURATION, true)).toBeNull();
    expect(tracker.play(0, DURATION)).toBe("replay");
    // The replay is a new run that can earn its own full view.
    expect(playThrough(tracker, 0, 9)).toEqual(["full_view"]);
  });

  it("counts one replay when play arrives before the seek back", () => {
    const tracker = createViewTracker();
    tracker.play(0, DURATION);
    playThrough(tracker, 0, DURATION);
    tracker.ended(DURATION);
    // Native play on an ended video: `play` may still see the end position,
    // and the browser's seek back to 0 lands while playing.
    expect(tracker.play(DURATION, DURATION)).toBeNull();
    expect(tracker.seeked(0, DURATION, false)).toBe("replay");
  });

  it("counts one replay when the seek back arrives before play", () => {
    const tracker = createViewTracker();
    tracker.play(0, DURATION);
    playThrough(tracker, 0, DURATION);
    tracker.ended(DURATION);
    expect(tracker.seeked(0, DURATION, false)).toBe("replay");
    expect(tracker.play(0, DURATION)).toBeNull();
  });

  it("counts a replay when the viewer seeks back after a full view", () => {
    const tracker = createViewTracker();
    tracker.play(0, DURATION);
    playThrough(tracker, 0, 9.25);
    expect(tracker.seeked(2, DURATION, false)).toBe("replay");
  });

  it("does not count seeking around an unfinished clip as a replay", () => {
    const tracker = createViewTracker();
    tracker.play(0, DURATION);
    playThrough(tracker, 0, 4);
    expect(tracker.seeked(0, DURATION, false)).toBeNull();
    tracker.seeked(3, DURATION, true);
    expect(tracker.play(3, DURATION)).toBeNull();
  });

  it("does not count resuming near the end after a full view as a replay", () => {
    const tracker = createViewTracker();
    tracker.play(0, DURATION);
    playThrough(tracker, 0, 9.5);
    expect(tracker.play(9.5, DURATION)).toBeNull();
  });
});
