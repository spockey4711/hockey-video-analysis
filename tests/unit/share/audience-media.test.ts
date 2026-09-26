import { describe, expect, it } from "vitest";

import {
  DRIFT_TOLERANCE_S,
  mediaCorrection,
  presenterMedia,
  presenterTimeAt,
} from "@/features/share/presentation/audience-media";
import type { AudienceMedia } from "@/features/share/presentation/audience-protocol";

const playing: AudienceMedia = {
  playing: true,
  held: false,
  time: 10,
  rate: 1,
  at: 5_000,
};
const paused: AudienceMedia = { ...playing, playing: false };

describe("presenterTimeAt", () => {
  it("moves a running clip on by the time since it was read, at its rate", () => {
    expect(presenterTimeAt(playing, 6_000)).toBe(11);
    expect(presenterTimeAt({ ...playing, rate: 0.5 }, 6_000)).toBe(10.5);
  });

  it("keeps a paused or held clip where it was read", () => {
    expect(presenterTimeAt(paused, 9_000)).toBe(10);
    expect(presenterTimeAt({ ...playing, held: true }, 9_000)).toBe(10);
  });

  it("never runs backwards on a clock that is behind", () => {
    expect(presenterTimeAt(playing, 4_000)).toBe(10);
  });

  it("has no time for a scene", () => {
    expect(presenterTimeAt({ ...playing, time: null }, 6_000)).toBeNull();
  });
});

describe("mediaCorrection", () => {
  it("starts a stopped clip where the presenter's is", () => {
    expect(
      mediaCorrection(playing, 5_500, { playing: false, held: false, time: 0 }),
    ).toEqual({ seekTo: 10.5, play: true, pause: false });
  });

  it("pauses on the presenter's frame", () => {
    expect(
      mediaCorrection(paused, 9_000, { playing: true, held: false, time: 11 }),
    ).toEqual({ seekTo: 10, play: false, pause: true });
  });

  it("leaves a still picture on the same frame alone", () => {
    expect(
      mediaCorrection(paused, 9_000, {
        playing: false,
        held: false,
        time: 10.01,
      }),
    ).toEqual({ seekTo: null, play: false, pause: false });
  });

  it("lets a small drift be and seeks past the tolerance", () => {
    const near = 10 + DRIFT_TOLERANCE_S / 2;
    const far = 10 + DRIFT_TOLERANCE_S * 2;
    expect(
      mediaCorrection(playing, 5_000, {
        playing: true,
        held: false,
        time: near,
      }),
    ).toEqual({ seekTo: null, play: false, pause: false });
    expect(
      mediaCorrection(playing, 5_000, {
        playing: true,
        held: false,
        time: far,
      }),
    ).toEqual({ seekTo: 10, play: false, pause: false });
  });

  it("mirrors the presenter's hold as a still picture on its frame", () => {
    const held = { ...playing, held: true, time: 2.017 };
    // Playing past the marker, or held on it by its own stage: stop there.
    expect(
      mediaCorrection(held, 7_000, { playing: true, held: false, time: 2.3 }),
    ).toEqual({ seekTo: 2.017, play: false, pause: true });
    expect(
      mediaCorrection(held, 7_000, { playing: true, held: true, time: 2.01 }),
    ).toEqual({ seekTo: null, play: false, pause: true });
    // Joining during the hold: onto the held frame, without starting.
    expect(
      mediaCorrection(held, 7_000, { playing: false, held: false, time: 0 }),
    ).toEqual({ seekTo: 2.017, play: false, pause: false });
  });

  it("leaves its own hold to resolve by itself while the presenter plays", () => {
    expect(
      mediaCorrection(playing, 5_000, { playing: true, held: true, time: 10 }),
    ).toEqual({ seekTo: null, play: false, pause: false });
  });

  it("does nothing for a scene, which follows play and pause by itself", () => {
    expect(
      mediaCorrection({ ...playing, time: null }, 6_000, {
        playing: false,
        held: false,
        time: 0,
      }),
    ).toEqual({ seekTo: null, play: false, pause: false });
  });
});

describe("presenterMedia", () => {
  const video = { paused: false, currentTime: 3, playbackRate: 1 };

  it("reads a plain clip off its element", () => {
    expect(
      presenterMedia(
        { kind: "clip", staged: false, isPlaying: false },
        video,
        42,
      ),
    ).toEqual({ playing: true, held: false, time: 3, rate: 1, at: 42 });
  });

  it("counts a staged clip held on a marker as playing and held", () => {
    expect(
      presenterMedia(
        { kind: "clip", staged: true, isPlaying: true },
        { ...video, paused: true, playbackRate: 0.5 },
        42,
      ),
    ).toEqual({ playing: true, held: true, time: 3, rate: 0.5, at: 42 });
  });

  it("sends a still picture as the frame on screen", () => {
    const still = { ...video, paused: true, currentTime: 1.4318 };
    const entry = { kind: "clip", staged: false, isPlaying: false } as const;
    expect(presenterMedia(entry, still, 42, 1.44).time).toBe(1.44);
    // A frame from before a seek says nothing; a running clip goes by its clock.
    expect(presenterMedia(entry, still, 42, 3.2).time).toBe(1.4318);
    expect(presenterMedia(entry, video, 42, 2.96).time).toBe(3);
  });

  it("gives a scene no time", () => {
    expect(
      presenterMedia(
        { kind: "scene", staged: false, isPlaying: true },
        null,
        42,
      ),
    ).toEqual({ playing: true, held: false, time: null, rate: 1, at: 42 });
  });
});
