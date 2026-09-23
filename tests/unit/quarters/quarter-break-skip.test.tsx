import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PlayerControllerProvider,
  type PlayerController,
} from "@/features/player/PlayerContext";
import { QuarterBreakSkip } from "@/features/quarters/QuarterBreakSkip";
import type { Quarter } from "@/features/quarters/navigation";

// Q1 ends at 15:00 and Q2 starts at 20:00, leaving a five-minute break.
const quarters: Quarter[] = [
  { index: 1, startS: 0, endS: 900 },
  { index: 2, startS: 1200, endS: null },
];

const seekTo = vi.fn();

function controller(gameTimeS: number, isPlaying: boolean): PlayerController {
  return {
    gameTimeS,
    durationS: 3600,
    isPlaying,
    isBuffering: false,
    playbackRate: 1,
    activeSourceIndex: 0,
    getGameTimeS: () => gameTimeS,
    seekTo,
    seekBy: vi.fn(),
    stepBy: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    togglePlay: vi.fn(),
    setPlaybackRate: vi.fn(),
  };
}

function ui(gameTimeS: number, isPlaying: boolean) {
  return (
    <PlayerControllerProvider value={controller(gameTimeS, isPlaying)}>
      <QuarterBreakSkip quarters={quarters} />
    </PlayerControllerProvider>
  );
}

afterEach(() => {
  cleanup();
  seekTo.mockReset();
});

describe("QuarterBreakSkip", () => {
  it("jumps to the next quarter when playback enters a break", () => {
    const { rerender } = render(ui(899.8, true));
    expect(seekTo).not.toHaveBeenCalled();

    rerender(ui(900.1, true));
    expect(seekTo).toHaveBeenCalledExactlyOnceWith(1200);
  });

  it("seeks only once while the jump is still landing", () => {
    const { rerender } = render(ui(900.1, true));
    rerender(ui(900.3, true));
    expect(seekTo).toHaveBeenCalledTimes(1);
  });

  it("leaves a paused playhead in a break alone", () => {
    render(ui(1000, false));
    expect(seekTo).not.toHaveBeenCalled();
  });

  it("skips again when play resumes inside a break", () => {
    const { rerender } = render(ui(900.1, true));
    rerender(ui(1000, false));
    rerender(ui(1000, true));
    expect(seekTo).toHaveBeenCalledTimes(2);
    expect(seekTo).toHaveBeenLastCalledWith(1200);
  });
});
