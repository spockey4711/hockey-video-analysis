import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContinuousPlayer, playerContent } from "@/features/player";
import type { PlayerSource } from "@/features/player";

// jsdom implements neither media playback nor the Fullscreen API; stub the bits
// the stage touches so the player can hand itself to the "screen".
let requestFullscreen: ReturnType<typeof vi.fn>;
let exitFullscreen: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get: () => 0,
    set: () => {},
  });
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();

  requestFullscreen = vi.fn().mockResolvedValue(undefined);
  exitFullscreen = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, "requestFullscreen");
  Reflect.deleteProperty(document, "exitFullscreen");
  Reflect.deleteProperty(document, "fullscreenElement");
});

const sources: PlayerSource[] = [
  {
    src: "https://media.test/a.mp4",
    durationS: 250,
    frameRate: null,
    label: "a.mp4",
  },
];

const { fullscreen, status, transport } = playerContent;

/** Make the Fullscreen API available before the player probes for it. */
function installFullscreenApi(): void {
  Object.defineProperty(Element.prototype, "requestFullscreen", {
    configurable: true,
    writable: true,
    value: requestFullscreen,
  });
  Object.defineProperty(document, "exitFullscreen", {
    configurable: true,
    writable: true,
    value: exitFullscreen,
  });
}

/** The element the player hands to the Fullscreen API: the video's stage. */
function stageOf(container: HTMLElement): HTMLElement {
  const video = container.querySelector("video");
  if (!video?.parentElement) throw new Error("no video stage rendered");
  return video.parentElement;
}

/** Tell the page that `element` now owns the screen, as the browser would. */
function screenTakenBy(element: Element | null): void {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: element,
  });
  fireEvent(document, new Event("fullscreenchange"));
}

describe("fullscreen tagging stage", () => {
  it("offers no fullscreen switch where the browser has no API", () => {
    render(<ContinuousPlayer sources={sources} title="HSV" />);

    expect(screen.getByLabelText(fullscreen.enter)).toBeDisabled();
  });

  it("hands the video stage - not the workspace - to the screen", () => {
    installFullscreenApi();
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );

    fireEvent.click(screen.getByLabelText(fullscreen.enter));

    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(requestFullscreen.mock.instances[0]).toBe(stageOf(container));
  });

  it("toggles on the F key", () => {
    installFullscreenApi();
    render(<ContinuousPlayer sources={sources} title="HSV" />);

    fireEvent.keyDown(window, { key: "f" });
    expect(requestFullscreen).toHaveBeenCalledOnce();

    // Shift is a transport modifier, so the capital must work the same way.
    fireEvent.keyDown(window, { key: "F", shiftKey: true });
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
  });

  it("moves the tag controls onto the stage and back", () => {
    installFullscreenApi();
    const { container } = render(
      <ContinuousPlayer
        sources={sources}
        title="HSV"
        tagControls={<span data-testid="tag-controls" />}
      />,
    );

    const stage = stageOf(container);
    expect(stage).not.toContainElement(screen.getByTestId("tag-controls"));

    screenTakenBy(stage);
    // Rendered exactly once, now inside the stage: two copies would mean two
    // tag-capture hotkey listeners and a double capture per key press.
    expect(screen.getByTestId("tag-controls")).toBeInTheDocument();
    expect(stage).toContainElement(screen.getByTestId("tag-controls"));

    screenTakenBy(null);
    expect(stage).not.toContainElement(screen.getByTestId("tag-controls"));
  });

  it("leaves the screen from the stage's own exit button", () => {
    installFullscreenApi();
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );

    screenTakenBy(stageOf(container));
    fireEvent.click(screen.getByLabelText(fullscreen.exit));

    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  it("keeps the paused play button above the idle cursor catcher", () => {
    vi.useFakeTimers();
    installFullscreenApi();
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );
    const stage = stageOf(container);
    screenTakenBy(stage);

    // Once the chrome idles away, a catcher covers the frame to hide the cursor.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const catcher = stage.querySelector(':scope > [aria-hidden="true"]');
    if (!catcher) throw new Error("no idle cursor catcher rendered");

    // Both are absolutely positioned without a z-index, so paint order is DOM
    // order: the play button must come later, or the catcher swallows the tap.
    const play = within(
      screen.getByRole("status", { name: status.paused }),
    ).getByRole("button", { name: transport.play });
    expect(
      catcher.compareDocumentPosition(play) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(play);
    expect(stage.querySelector("video")?.play).toHaveBeenCalledOnce();
  });
});
