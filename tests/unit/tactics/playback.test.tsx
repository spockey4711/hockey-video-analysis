import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneEditor } from "@/features/tactics/SceneEditor";
import { tacticsContent } from "@/features/tactics/content";
import { SCENE_VERSION, type TacticsScene } from "@/features/tactics/scene";

// The editor's forms post to server actions; the board never calls them here.
vi.mock("@/features/tactics/actions", () => ({
  saveSceneAction: vi.fn(),
  duplicateSceneAction: vi.fn(),
  deleteSceneAction: vi.fn(),
}));
vi.mock("@/features/tactics/formation-actions", () => ({
  saveSceneAsFormationAction: vi.fn(),
}));

const { steps, playback } = tacticsContent;

/** Heim 7 runs 10 m right in one 2 s step; a start line and a step line. */
const SCENE: TacticsScene = {
  version: SCENE_VERSION,
  view: "full",
  tokens: [
    {
      id: "p1",
      kind: "player",
      team: "home",
      label: "7",
      playerId: null,
      x: 10,
      y: 20,
    },
  ],
  lines: [
    {
      id: "l1",
      tool: "arrow",
      color: "white",
      width: "medium",
      style: "solid",
      points: [
        { x: 10, y: 20 },
        { x: 20, y: 20 },
      ],
      step: 1,
    },
  ],
  steps: [{ duration: 2, moves: [{ token: "p1", x: 20, y: 20, via: null }] }],
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
  });
  // jsdom has no media queries; the board lies in landscape.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderEditor() {
  render(<SceneEditor sceneId="s1" name="Konter" scene={SCENE} roster={[]} />);
}

/** Heim 7's position on the board, as `[x, y]` in pitch metres. */
function heim7(): [number, number] {
  const transform = screen
    .getByRole("button", { name: "Heim 7" })
    .getAttribute("transform");
  const match = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(transform ?? "");
  return [Number(match?.[1]), Number(match?.[2])];
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("tactics playback", () => {
  it("plays a step's run, pauses partway and rests on the last step", () => {
    renderEditor();
    expect(heim7()).toEqual([10, 20]);
    expect(screen.queryByRole("button", { name: "Pfeil 1" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: playback.play }));
    advance(1000);
    const [x] = heim7();
    expect(x).toBeGreaterThan(12);
    expect(x).toBeLessThan(18);
    // The step's arrow shows while it plays; the board only shows.
    expect(screen.getByRole("button", { name: "Pfeil 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heim 7" })).toHaveAttribute(
      "tabindex",
      "-1",
    );

    fireEvent.click(screen.getByRole("button", { name: playback.pause }));
    advance(1000);
    expect(heim7()[0]).toBe(x);

    fireEvent.click(screen.getByRole("button", { name: playback.play }));
    advance(2000);
    expect(heim7()).toEqual([20, 20]);
    expect(screen.getByRole("button", { name: steps.step(1) })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: playback.play })).toBeEnabled();
  });

  it("steps with the keyboard and plays with the space bar", () => {
    renderEditor();
    const board = screen.getByRole("group", {
      name: tacticsContent.board.pitch,
    });

    fireEvent.keyDown(board, { key: "n" });
    expect(heim7()).toEqual([20, 20]);
    fireEvent.keyDown(board, { key: "b" });
    expect(heim7()).toEqual([10, 20]);

    fireEvent.keyDown(board, { key: " " });
    expect(
      screen.getByRole("button", { name: playback.pause }),
    ).toBeInTheDocument();
    fireEvent.keyDown(board, { key: " " });
    expect(
      screen.getByRole("button", { name: playback.play }),
    ).toBeInTheDocument();
  });

  it("adds a step and sets its duration", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: steps.step(1) }));
    fireEvent.click(screen.getByRole("button", { name: steps.add }));

    expect(screen.getByRole("button", { name: steps.step(2) })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.change(screen.getByLabelText(steps.duration), {
      target: { value: "4" },
    });
    const scrubber = screen.getByRole("slider", { name: playback.position });
    expect(scrubber).toHaveAttribute("max", "6");
    expect(scrubber).toHaveAttribute("aria-valuetext", playback.time(6, 6));

    fireEvent.click(screen.getByRole("button", { name: steps.remove }));
    expect(screen.queryByRole("button", { name: steps.step(2) })).toBeNull();
  });
});
