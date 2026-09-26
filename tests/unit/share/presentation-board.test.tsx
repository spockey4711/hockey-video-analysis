import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { telestrationContent as drawCopy } from "@/features/player/telestration";
import type { PlaylistItem } from "@/features/share/playlist/types";
import { PresentationMode } from "@/features/share/presentation/PresentationMode";
import { presentationContent } from "@/features/share/presentation/content";
import { tacticsContent } from "@/features/tactics/content";
import { SCENE_VERSION, type TacticsScene } from "@/features/tactics/scene";

const copy = tacticsContent.presentation;

const items: PlaylistItem[] = [
  { id: "a", src: "/a.mp4", title: "Tor", subtitle: "Spiel 1 - 1:00" },
  { id: "b", src: "/b.mp4", title: "Ecke kurz", subtitle: "Spiel 1 - 2:00" },
];

const SCENE_ID = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";
const SAVED: TacticsScene = {
  version: SCENE_VERSION,
  tokens: [
    {
      id: "p1",
      kind: "player",
      team: "home",
      label: "LV",
      playerId: null,
      x: 60,
      y: 20,
    },
  ],
  lines: [],
  steps: [],
};

let pause: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockReturnValue(undefined);
  // jsdom has no canvas backend or media queries: the drawing layer copes
  // without a 2D context, and the board lies in landscape.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function start(props: Partial<Parameters<typeof PresentationMode>[0]> = {}) {
  render(<PresentationMode items={items} playback="manual" {...props} />);
  fireEvent.click(
    screen.getByRole("button", { name: presentationContent.launch }),
  );
  return screen.getByRole("dialog", { name: presentationContent.regionLabel });
}

function board(): HTMLElement | null {
  return screen.queryByRole("region", { name: copy.label });
}

function boardButton(): HTMLElement {
  return screen.getByRole("button", { name: presentationContent.board });
}

function sourcePicker(): HTMLSelectElement {
  return within(board() as HTMLElement).getByLabelText(
    copy.source,
  ) as HTMLSelectElement;
}

describe("PresentationMode tactics board", () => {
  it("is not mounted until opened", () => {
    start();
    expect(board()).not.toBeInTheDocument();
  });

  it("opens over the paused clip on its button, starting on the lineup", () => {
    const dialog = start();
    pause.mockClear();
    fireEvent.click(boardButton());

    const shown = board();
    expect(shown).toBeVisible();
    expect(pause).toHaveBeenCalled();
    expect(document.activeElement).toBe(shown);
    expect(within(dialog).getByRole("button", { name: "Heim 1" })).toBeTruthy();
    expect(sourcePicker().value).toBe("lineup");
  });

  it("opens with T and goes back to the same clip on T", () => {
    const dialog = start();
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    fireEvent.keyDown(dialog, { key: "t" });
    expect(board()).toBeVisible();

    fireEvent.keyDown(board() as HTMLElement, { key: "T" });
    expect(screen.queryByRole("region", { name: copy.label })).toBeNull();
    expect(document.activeElement).toBe(dialog);
    expect(screen.getByText("Ecke kurz")).toBeInTheDocument();
    expect(
      screen.getByText(presentationContent.counter(2, 2)),
    ).toBeInTheDocument();
  });

  it("ignores Ctrl+T, which belongs to the browser", () => {
    const dialog = start();
    fireEvent.keyDown(dialog, { key: "t", ctrlKey: true });
    expect(board()).not.toBeInTheDocument();
  });

  it("closes the board, not the presentation, on Escape", () => {
    const dialog = start();
    fireEvent.click(boardButton());
    fireEvent.keyDown(board() as HTMLElement, { key: "Escape" });

    expect(screen.queryByRole("region", { name: copy.label })).toBeNull();
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("goes back with its close button", () => {
    start();
    fireEvent.click(boardButton());
    fireEvent.click(screen.getByRole("button", { name: copy.close }));
    expect(screen.queryByRole("region", { name: copy.label })).toBeNull();
  });

  it("keeps the presentation's and the drawing's keys off the board", () => {
    start();
    fireEvent.click(boardButton());
    const token = screen.getByRole("button", { name: "Heim 1" });
    const before = token.getAttribute("transform");

    fireEvent.keyDown(token, { key: "ArrowRight" });
    fireEvent.keyDown(board() as HTMLElement, { key: "d" });
    fireEvent.keyDown(board() as HTMLElement, { key: "p" });

    expect(token.getAttribute("transform")).not.toBe(before);
    expect(
      screen.getByText(presentationContent.counter(1, 2)),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("toolbar", { name: drawCopy.toolbar }),
    ).not.toBeInTheDocument();
    expect(boardButton()).toHaveAttribute("aria-pressed", "true");
  });

  it("puts the drawing away as it opens", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: drawCopy.toggle }));
    fireEvent.click(boardButton());
    expect(
      screen.queryByRole("toolbar", { name: drawCopy.toolbar }),
    ).not.toBeInTheDocument();
  });

  it("switches to an empty pitch and keeps it between openings", () => {
    const dialog = start();
    fireEvent.click(boardButton());
    fireEvent.change(sourcePicker(), { target: { value: "empty" } });
    expect(screen.queryByRole("button", { name: "Heim 1" })).toBeNull();

    fireEvent.keyDown(board() as HTMLElement, { key: "t" });
    fireEvent.keyDown(dialog, { key: "t" });

    expect(sourcePicker().value).toBe("empty");
    expect(screen.queryByRole("button", { name: "Heim 1" })).toBeNull();
  });

  it("offers only the lineup and the empty pitch without saved scenes", () => {
    start();
    fireEvent.click(boardButton());
    expect(
      within(sourcePicker())
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([copy.lineup, copy.empty]);
  });

  it("loads a saved scene through the scene API", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: SCENE_ID, name: "Konter", scene: SAVED }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    start({ tacticsScenes: [{ id: SCENE_ID, name: "Konter" }] });
    fireEvent.click(boardButton());

    fireEvent.change(sourcePicker(), { target: { value: SCENE_ID } });

    expect(
      await screen.findByRole("button", { name: "Heim LV" }),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`/api/tactics/scenes/${SCENE_ID}`);
    expect(screen.queryByRole("button", { name: "Heim 1" })).toBeNull();
  });

  it("says so and keeps the board when a scene cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 401 })),
    );
    start({ tacticsScenes: [{ id: SCENE_ID, name: "Konter" }] });
    fireEvent.click(boardButton());

    fireEvent.change(sourcePicker(), { target: { value: SCENE_ID } });

    await waitFor(() =>
      expect(screen.getByText(copy.loadFailed)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Heim 1" })).toBeInTheDocument();
  });
});

describe("PresentationMode tactics board in native fullscreen", () => {
  let fullscreenElement: Element | null = null;

  beforeEach(() => {
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    HTMLElement.prototype.requestFullscreen = vi.fn(() => {
      fullscreenElement = document.querySelector("[role=dialog]");
      return Promise.resolve();
    });
  });

  afterEach(() => {
    fullscreenElement = null;
    Reflect.deleteProperty(document, "fullscreenElement");
    Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
  });

  it("only closes the board when fullscreen is left while it is up", () => {
    start();
    fireEvent.click(boardButton());

    // The browser takes Escape to leave fullscreen and never passes it on.
    fullscreenElement = null;
    fireEvent(document, new Event("fullscreenchange"));

    expect(screen.queryByRole("region", { name: copy.label })).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
