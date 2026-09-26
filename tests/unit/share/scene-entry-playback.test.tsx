import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlaylistPlayer } from "@/features/share/playlist";
import { playlistContent } from "@/features/share/playlist/content";
import type {
  PlaylistEntry,
  ScenePlaylistItem,
} from "@/features/share/playlist/types";
import { PresentationMode } from "@/features/share/presentation/PresentationMode";
import { presentationContent } from "@/features/share/presentation/content";
import { SCENE_VERSION, type TacticsScene } from "@/features/tactics/scene";

const ANIMATED: TacticsScene = {
  version: SCENE_VERSION,
  view: "full",
  tokens: [
    {
      id: "p1",
      kind: "player",
      team: "home",
      label: "9",
      playerId: null,
      x: 20,
      y: 20,
    },
  ],
  lines: [],
  steps: [{ duration: 2, moves: [{ token: "p1", x: 60, y: 20, via: null }] }],
};

function sceneItem(overrides: Partial<ScenePlaylistItem> = {}) {
  return {
    kind: "scene",
    id: "entry-1",
    title: "Konter",
    subtitle: "Taktikszene - Animation, 2 s",
    scene: ANIMATED,
    holdS: 8,
    ...overrides,
  } satisfies ScenePlaylistItem;
}

const clip = { id: "a", src: "/a.mp4", title: "Tor", subtitle: "Spiel 1" };

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockReturnValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** The x position of the scene's player 9, in pitch metres. */
function tokenX(): number {
  const drawing = screen.getByRole("img", { name: "Konter" });
  const token = drawing.querySelector("g[transform^='translate']");
  const match = /translate\(([-\d.]+)/.exec(
    token?.getAttribute("transform") ?? "",
  );
  return Number(match?.[1]);
}

describe("PlaylistPlayer with a scene entry", () => {
  const items: PlaylistEntry[] = [clip, sceneItem()];

  function openScene(): void {
    render(<PlaylistPlayer items={items} playback="manual" />);
    const list = screen.getByRole("navigation", {
      name: playlistContent.playlist.heading,
    });
    fireEvent.click(within(list).getByRole("button", { name: /Konter/ }));
  }

  it("draws the scene in the clip's place, waiting for play", () => {
    openScene();
    expect(screen.getByRole("img", { name: "Konter" })).toBeInTheDocument();
    expect(document.querySelector("video")).toBeNull();
    advance(1000);
    expect(tokenX()).toBe(20);
  });

  it("runs the animation on play and offers a replay at its end", () => {
    openScene();
    fireEvent.click(
      screen.getByRole("button", { name: playlistContent.transport.play }),
    );
    advance(1000);
    expect(tokenX()).toBeGreaterThan(20);
    expect(tokenX()).toBeLessThan(60);

    advance(1500);
    expect(tokenX()).toBe(60);
    const ended = screen.getByRole("group", {
      name: playlistContent.sceneEnded,
    });
    fireEvent.click(
      within(ended).getByRole("button", {
        name: playlistContent.transport.replay,
      }),
    );
    advance(100);
    expect(tokenX()).toBeLessThan(60);
  });

  it("draws a short-corner scene cropped to its quarter, goal at the top", () => {
    render(
      <PlaylistPlayer
        items={[sceneItem({ scene: { ...ANIMATED, view: "corner" } })]}
        playback="manual"
      />,
    );
    const drawing = screen.getByRole("img", { name: "Konter" });
    expect(drawing).toHaveAttribute("viewBox", "0 0 59 26.9");
    // Player 9 starts inside the quarter and runs out of it.
    expect(tokenX()).toBe(20);
    fireEvent.click(
      screen.getByRole("button", { name: playlistContent.transport.play }),
    );
    advance(2500);
    expect(drawing.querySelector("g[transform^='translate']")).toBeNull();
  });

  it("holds a still scene for its hold time", () => {
    render(
      <PlaylistPlayer
        items={[sceneItem({ scene: { ...ANIMATED, steps: [] }, holdS: 3 })]}
        playback="manual"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: playlistContent.transport.play }),
    );
    advance(2500);
    expect(
      screen.queryByRole("group", { name: playlistContent.sceneEnded }),
    ).toBeNull();
    advance(1000);
    expect(
      screen.getByRole("group", { name: playlistContent.sceneEnded }),
    ).toBeInTheDocument();
    expect(tokenX()).toBe(20);
  });

  it("steps on to the next entry after a scene in continuous playback", () => {
    render(
      <PlaylistPlayer
        items={[
          sceneItem({ scene: { ...ANIMATED, steps: [] }, holdS: 3 }),
          clip,
        ]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: playlistContent.transport.play }),
    );
    advance(3500);
    expect(document.querySelector("video")).not.toBeNull();
  });
});

describe("PresentationMode with a scene entry", () => {
  function present(): HTMLElement {
    render(<PresentationMode items={[clip, sceneItem()]} playback="manual" />);
    fireEvent.click(
      screen.getByRole("button", { name: presentationContent.launch }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    return dialog;
  }

  it("shows the scene as its own entry and plays it on the transport", () => {
    present();
    expect(screen.getByText("Konter")).toBeInTheDocument();
    expect(
      screen.getByText(presentationContent.counter(2, 2)),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: presentationContent.transport.play }),
    );
    advance(2500);
    expect(tokenX()).toBe(60);
    expect(
      screen.getByRole("button", {
        name: presentationContent.transport.replay,
      }),
    ).toBeInTheDocument();
  });

  it("offers no drawing on a scene", () => {
    const dialog = present();
    fireEvent.keyDown(dialog, { key: "d" });
    expect(screen.getByRole("button", { name: /Zeichnen/ })).toBeDisabled();
    expect(screen.queryByRole("toolbar", { name: /Zeichen/ })).toBeNull();
  });
});
