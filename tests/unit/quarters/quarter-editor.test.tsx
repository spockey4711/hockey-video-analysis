import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PlayerControllerProvider,
  type PlayerController,
} from "@/features/player/PlayerContext";
import { QuarterEditor } from "@/features/quarters/QuarterEditor";
import { quartersContent } from "@/features/quarters/content";

const gameId = "11111111-1111-4111-8111-111111111111";

function makeController(
  overrides: Partial<PlayerController> = {},
): PlayerController {
  return {
    gameTimeS: 0,
    durationS: 3600,
    isPlaying: false,
    isBuffering: false,
    activeSourceIndex: 0,
    getGameTimeS: () => 0,
    seekTo: vi.fn(),
    seekBy: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    togglePlay: vi.fn(),
    ...overrides,
  };
}

function renderEditor(controller: PlayerController) {
  return render(
    <PlayerControllerProvider value={controller}>
      <QuarterEditor gameId={gameId} initialQuarters={[]} />
    </PlayerControllerProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("QuarterEditor", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
    );
  });

  it("marks a quarter start from the current game time and saves the set", async () => {
    const controller = makeController({ getGameTimeS: () => 123 });
    renderEditor(controller);

    const setButtons = screen.getAllByRole("button", {
      name: quartersContent.setStart,
    });
    fireEvent.click(setButtons[0]);

    fireEvent.click(screen.getByRole("button", { name: quartersContent.save }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/quarters",
      expect.objectContaining({ method: "PUT" }),
    );
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toEqual({
      gameId,
      quarters: [{ index: 1, startS: 123, endS: null }],
    });
  });

  it("keeps save disabled until a quarter is marked", () => {
    renderEditor(makeController());
    expect(
      screen.getByRole("button", { name: quartersContent.save }),
    ).toBeDisabled();
  });

  it("jumps to a marked quarter's start", () => {
    const controller = makeController({ getGameTimeS: () => 300 });
    renderEditor(controller);

    fireEvent.click(
      screen.getAllByRole("button", { name: quartersContent.setStart })[0],
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: quartersContent.jump })[0],
    );

    expect(controller.seekTo).toHaveBeenCalledWith(300);
  });

  it("surfaces a save failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400, json: async () => ({}) })),
    );
    renderEditor(makeController({ getGameTimeS: () => 10 }));

    fireEvent.click(
      screen.getAllByRole("button", { name: quartersContent.setStart })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: quartersContent.save }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        quartersContent.errors.save,
      ),
    );
  });
});
