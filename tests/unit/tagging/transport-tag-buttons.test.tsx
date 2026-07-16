import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContinuousPlayer, type PlayerSource } from "@/features/player";
import { GameTagsProvider, TransportTagButtons } from "@/features/tagging";

const gameId = "11111111-1111-4111-8111-111111111111";

// jsdom does not implement media playback; stub the bits the player reads so the
// controller can report a real game time to the tag buttons.
let currentTime = 0;
beforeEach(() => {
  currentTime = 0;
  Object.defineProperty(window.HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
  });
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({
        tag: { id: "tag-1", type: "goal", startS: 90, endS: 105 },
      }),
    })) as unknown as typeof fetch,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// One chapter, total 250s.
const sources: PlayerSource[] = [
  { src: "https://media.test/a.mp4", durationS: 250 },
];

function renderButtons() {
  render(
    <GameTagsProvider>
      <ContinuousPlayer
        sources={sources}
        title="HSV"
        tagControls={<TransportTagButtons gameId={gameId} />}
      />
    </GameTagsProvider>,
  );
}

/** The persisted window a goal capture at 100s (pre 10 / post 5) resolves to. */
const goalWindow = { gameId, type: "goal", startS: 90, endS: 105 };

describe("TransportTagButtons", () => {
  it("captures live player time on a bound key and posts the window", async () => {
    renderButtons();

    // Move the video to 100s; capture must read this live game time.
    currentTime = 100;
    fireEvent.keyDown(window, { key: "t" });

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toEqual(goalWindow);
  });

  it("captures the same window from a button click", async () => {
    renderButtons();

    currentTime = 100;
    fireEvent.click(screen.getByTitle("Tor (T)"));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toEqual(goalWindow);
  });

  it("ignores a bound key while typing in a field", () => {
    render(
      <GameTagsProvider>
        <ContinuousPlayer
          sources={sources}
          title="HSV"
          tagControls={<TransportTagButtons gameId={gameId} />}
          aside={<input aria-label="note" />}
        />
      </GameTagsProvider>,
    );

    currentTime = 100;
    fireEvent.keyDown(screen.getByLabelText("note"), { key: "t" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
