import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub the router the editor refreshes after a save, so the page's persisted
// quarters (clock, bands, break skipping) pick up the new set.
const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import {
  PlayerControllerProvider,
  type PlayerController,
} from "@/features/player/PlayerContext";
import { QuarterEditor } from "@/features/quarters/QuarterEditor";
import { quartersContent } from "@/features/quarters/content";
import type { Quarter } from "@/features/quarters/navigation";

const gameId = "11111111-1111-4111-8111-111111111111";
const quarters = quartersContent(4);
const halves = quartersContent(2);

function makeController(
  overrides: Partial<PlayerController> = {},
): PlayerController {
  return {
    gameTimeS: 0,
    durationS: 3600,
    isPlaying: false,
    isBuffering: false,
    playbackRate: 1,
    activeSourceIndex: 0,
    frameS: 1 / 25,
    getGameTimeS: () => 0,
    seekTo: vi.fn(),
    seekBy: vi.fn(),
    stepBy: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    togglePlay: vi.fn(),
    setPlaybackRate: vi.fn(),
    ...overrides,
  };
}

function renderEditor(
  controller: PlayerController,
  initialQuarters: readonly Quarter[] = [],
  periodCount: 2 | 4 = 4,
) {
  return render(
    <PlayerControllerProvider value={controller}>
      <QuarterEditor
        gameId={gameId}
        initialQuarters={initialQuarters}
        periodCount={periodCount}
      />
    </PlayerControllerProvider>,
  );
}

function click(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

function savedBody(): unknown {
  return JSON.parse(
    (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockRefresh.mockReset();
});

describe("QuarterEditor", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
    );
  });

  it("marks a quarter start from the current game time and saves the set", async () => {
    renderEditor(makeController({ getGameTimeS: () => 123 }));

    click(quarters.setStart(1));
    click(quarters.save);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/quarters",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(savedBody()).toEqual({
      gameId,
      quarters: [{ index: 1, startS: 123, endS: null }],
    });
  });

  it("marks where a quarter ends and where the next one starts", async () => {
    let nowS = 60;
    renderEditor(makeController({ getGameTimeS: () => nowS }));

    click(quarters.setStart(1));
    nowS = 960;
    click(quarters.setEnd(1));
    nowS = 1260;
    click(quarters.setStart(2));
    click(quarters.save);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(savedBody()).toEqual({
      gameId,
      quarters: [
        { index: 1, startS: 60, endS: 960 },
        { index: 2, startS: 1260, endS: null },
      ],
    });
  });

  it("refreshes the page after a successful save", async () => {
    renderEditor(makeController({ getGameTimeS: () => 5 }));

    click(quarters.setStart(1));
    click(quarters.save);

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status").textContent).toBe(quarters.saved);
  });

  it("clears a marked end", async () => {
    renderEditor(makeController(), [{ index: 1, startS: 0, endS: 900 }]);

    click(quarters.clearEnd(1));
    click(quarters.save);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(savedBody()).toEqual({
      gameId,
      quarters: [{ index: 1, startS: 0, endS: null }],
    });
  });

  it("keeps the end unmarkable until the quarter has a start", () => {
    renderEditor(makeController());
    expect(
      screen.getByRole("button", { name: quarters.setEnd(1) }),
    ).toBeDisabled();
  });

  it("keeps save disabled until a quarter is marked", () => {
    renderEditor(makeController());
    expect(screen.getByRole("button", { name: quarters.save })).toBeDisabled();
  });

  it("explains an invalid set and keeps save disabled", () => {
    renderEditor(makeController({ getGameTimeS: () => 1300 }), [
      { index: 1, startS: 0, endS: 900 },
      { index: 2, startS: 1200, endS: null },
    ]);

    click(quarters.setEnd(1));

    expect(screen.getByRole("status").textContent).toBe(
      quarters.problems.overlap,
    );
    expect(screen.getByRole("button", { name: quarters.save })).toBeDisabled();
  });

  it("shows one row per quarter in a game of four quarters", () => {
    renderEditor(makeController());
    expect(screen.getByText(quarters.quarterLabel(4))).toBeInTheDocument();
  });

  it("shows two halves, worded as halves, in a game of two halves", async () => {
    renderEditor(makeController({ getGameTimeS: () => 90 }), [], 2);

    expect(screen.getByText(halves.quarterLabel(1))).toBeInTheDocument();
    expect(screen.getByText(halves.quarterLabel(2))).toBeInTheDocument();
    expect(screen.queryByText(quarters.quarterLabel(3))).toBeNull();
    expect(screen.queryByText("3. Halbzeit")).toBeNull();

    click(halves.setStart(1));
    click(halves.save);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(savedBody()).toEqual({
      gameId,
      quarters: [{ index: 1, startS: 90, endS: null }],
    });
  });

  it("jumps to a marked quarter's start", () => {
    const controller = makeController({ getGameTimeS: () => 300 });
    renderEditor(controller);

    click(quarters.setStart(1));
    click(quarters.jump(1));

    expect(controller.seekTo).toHaveBeenCalledWith(300);
  });

  it("surfaces a save failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400, json: async () => ({}) })),
    );
    renderEditor(makeController({ getGameTimeS: () => 10 }));

    click(quarters.setStart(1));
    click(quarters.save);

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(quarters.errors.save),
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
