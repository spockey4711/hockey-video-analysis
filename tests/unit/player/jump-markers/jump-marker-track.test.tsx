import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  PlayerControllerProvider,
  type PlayerController,
} from "@/features/player/PlayerContext";
import { JumpMarkerTrack } from "@/features/player/jump-markers";
import type { JumpMarker } from "@/features/player/jump-markers";

afterEach(cleanup);

function makeController(durationS: number): PlayerController {
  return {
    gameTimeS: 0,
    durationS,
    isPlaying: false,
    isBuffering: false,
    playbackRate: 1,
    activeSourceIndex: 0,
    getGameTimeS: () => 0,
    seekTo: () => {},
    seekBy: () => {},
    stepBy: () => {},
    play: () => {},
    pause: () => {},
    togglePlay: () => {},
    setPlaybackRate: () => {},
  };
}

const markers: JumpMarker[] = [
  { id: "a", type: "goal", startS: 0 },
  { id: "b", type: "corner_short", startS: 900 },
];

function renderTrack(durationS: number, list: readonly JumpMarker[] = markers) {
  return render(
    <PlayerControllerProvider value={makeController(durationS)}>
      <JumpMarkerTrack markers={list} />
    </PlayerControllerProvider>,
  );
}

describe("JumpMarkerTrack", () => {
  it("places a tick at each marker's fraction of the live duration", () => {
    const { container } = renderTrack(1800);
    const ticks = container.querySelectorAll("span");
    expect(ticks).toHaveLength(2);
    expect((ticks[0] as HTMLElement).style.left).toBe("0%");
    expect((ticks[1] as HTMLElement).style.left).toBe("50%");
  });

  it("colours a tick with its tag-type token", () => {
    const { container } = renderTrack(1800);
    const tick = container.querySelector("span") as HTMLElement;
    expect(tick.style.backgroundColor).toBe("var(--tag-tor)");
  });

  it("renders nothing before the duration is known", () => {
    const { container } = renderTrack(0);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when there are no markers", () => {
    const { container } = renderTrack(1800, []);
    expect(container.firstChild).toBeNull();
  });
});
