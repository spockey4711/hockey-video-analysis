import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  PlayerControllerProvider,
  type PlayerController,
} from "@/features/player/PlayerContext";
import { QuarterTimelineLabels } from "@/features/quarters/overlay";

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

function renderLabels(
  durationS: number,
  quarters: readonly { index: number; startS: number; endS: number | null }[],
) {
  return render(
    <PlayerControllerProvider value={makeController(durationS)}>
      <QuarterTimelineLabels quarters={quarters} />
    </PlayerControllerProvider>,
  );
}

describe("QuarterTimelineLabels", () => {
  it("labels each quarter V1..Vn and places it by start fraction", () => {
    renderLabels(3600, [
      { index: 1, startS: 0, endS: 1800 },
      { index: 2, startS: 1800, endS: 3600 },
    ]);
    expect(screen.getByText("V1")).toBeInTheDocument();
    const second = screen.getByText("V2");
    expect((second as HTMLElement).style.left).toBe("50%");
  });

  it("draws nothing before the duration is known", () => {
    const { container } = renderLabels(0, [{ index: 1, startS: 0, endS: 600 }]);
    expect(container.firstChild).toBeNull();
  });
});
