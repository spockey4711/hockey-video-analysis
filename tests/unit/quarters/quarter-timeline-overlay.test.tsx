import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  PlayerControllerProvider,
  type PlayerController,
} from "@/features/player/PlayerContext";
import { QuarterTimelineOverlay } from "@/features/quarters/overlay";

afterEach(cleanup);

function makeController(
  overrides: Partial<PlayerController> = {},
): PlayerController {
  return {
    gameTimeS: 0,
    durationS: 0,
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
    ...overrides,
  };
}

type QuarterInput = readonly {
  index: number;
  startS: number;
  endS: number | null;
}[];

function renderOverlay(controller: PlayerController, quarters: QuarterInput) {
  return render(
    <PlayerControllerProvider value={controller}>
      <QuarterTimelineOverlay quarters={quarters} />
    </PlayerControllerProvider>,
  );
}

describe("QuarterTimelineOverlay", () => {
  it("places quarter bands using the player's live duration", () => {
    const { container } = renderOverlay(makeController({ durationS: 3600 }), [
      { index: 1, startS: 0, endS: 1800 },
      { index: 2, startS: 1800, endS: 3600 },
    ]);
    const markers = container.querySelectorAll("span");
    expect(markers).toHaveLength(2);
    expect((markers[1] as HTMLElement).style.left).toBe("50%");
  });

  it("draws no bands before the duration is known", () => {
    const { container } = renderOverlay(makeController({ durationS: 0 }), [
      { index: 1, startS: 0, endS: 600 },
    ]);
    expect(container.firstChild).toBeNull();
  });
});
