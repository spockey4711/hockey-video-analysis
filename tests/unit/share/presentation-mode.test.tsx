import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commentsContent } from "@/features/clips/comments/content";
import { telestrationContent as drawCopy } from "@/features/player/telestration";
import type { PlaylistItem } from "@/features/share/playlist/types";
import { PresentationMode } from "@/features/share/presentation/PresentationMode";
import { presentationContent } from "@/features/share/presentation/content";

const items: PlaylistItem[] = [
  { id: "a", src: "/a.mp4", title: "Tor", subtitle: "Spiel 1 - 1:00" },
  { id: "b", src: "/b.mp4", title: "Ecke kurz", subtitle: "Spiel 1 - 2:00" },
  { id: "c", src: "/c.mp4", title: "Aktion gut", subtitle: "Spiel 1 - 3:00" },
];

beforeEach(() => {
  // jsdom does not implement media playback; stub so control clicks are inert.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockReturnValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open() {
  fireEvent.click(
    screen.getByRole("button", { name: presentationContent.launch }),
  );
}

describe("PresentationMode", () => {
  it("renders nothing for an empty list", () => {
    const { container } = render(<PresentationMode items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the coach comment under the clip title once opened", () => {
    render(
      <PresentationMode
        items={[{ ...items[0], coachComment: "Früher abspielen." }, items[1]]}
      />,
    );
    open();
    const note = screen.getByText("Früher abspielen.", { exact: false });
    expect(note).toHaveTextContent(
      `${commentsContent.coachLabel}: Früher abspielen.`,
    );
    expect(note).toHaveClass("line-clamp-2");

    fireEvent.click(
      screen.getByRole("button", { name: presentationContent.transport.next }),
    );
    expect(
      screen.queryByText("Früher abspielen.", { exact: false }),
    ).toBeNull();
  });

  it("shows only the launch button until opened", () => {
    render(<PresentationMode items={items} />);
    expect(
      screen.getByRole("button", { name: presentationContent.launch }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a modal overlay on the first clip with a position readout", () => {
    render(<PresentationMode items={items} />);
    open();

    const dialog = screen.getByRole("dialog", {
      name: presentationContent.regionLabel,
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Tor")).toBeInTheDocument();
    expect(
      screen.getByText(presentationContent.counter(1, 3)),
    ).toBeInTheDocument();
  });

  it("advances to the next clip via the next button", () => {
    render(<PresentationMode items={items} />);
    open();
    fireEvent.click(
      screen.getByRole("button", { name: presentationContent.transport.next }),
    );

    expect(screen.getByText("Ecke kurz")).toBeInTheDocument();
    expect(
      screen.getByText(presentationContent.counter(2, 3)),
    ).toBeInTheDocument();
  });

  it("advances on arrow-right and retreats on arrow-left", () => {
    render(<PresentationMode items={items} />);
    open();
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(
      screen.getByText(presentationContent.counter(2, 3)),
    ).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(
      screen.getByText(presentationContent.counter(1, 3)),
    ).toBeInTheDocument();
  });

  it("disables previous on the first clip and next on the last", () => {
    render(<PresentationMode items={items} />);
    open();
    expect(
      screen.getByRole("button", {
        name: presentationContent.transport.previous,
      }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: presentationContent.transport.next }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: presentationContent.transport.next }),
    );

    expect(
      screen.getByRole("button", { name: presentationContent.transport.next }),
    ).toBeDisabled();
  });

  it("closes back to the launch button via the exit control", () => {
    render(<PresentationMode items={items} />);
    open();
    fireEvent.click(
      screen.getByRole("button", { name: presentationContent.transport.exit }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: presentationContent.launch }),
    ).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<PresentationMode items={items} />);
    open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("PresentationMode playback modes", () => {
  function video() {
    const element = document.querySelector("video");
    if (!element) throw new Error("no video element");
    return element;
  }

  it("starts on open and auto-advances in continuous playback", () => {
    render(<PresentationMode items={items} />);
    open();
    fireEvent.loadedData(video());
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    fireEvent.ended(video());
    expect(
      screen.getByText(presentationContent.counter(2, 3)),
    ).toBeInTheDocument();
  });

  it("waits for the viewer and stops at the end in manual playback", () => {
    render(<PresentationMode items={items} playback="manual" />);
    open();
    fireEvent.loadedData(video());
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    fireEvent.ended(video());
    expect(
      screen.getByText(presentationContent.counter(1, 3)),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: presentationContent.transport.replay,
      }),
    );
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: presentationContent.transport.next }),
    );
    fireEvent.loadedData(video());
    expect(
      screen.getByText(presentationContent.counter(2, 3)),
    ).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("counts views against the collection link when asked to", async () => {
    const beacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: beacon,
      configurable: true,
    });

    render(
      <PresentationMode
        items={items}
        playback="manual"
        views={{ shareToken: "collection-token" }}
      />,
    );
    open();
    fireEvent.play(video());
    expect(beacon).toHaveBeenCalledOnce();
    const [, blob] = beacon.mock.calls[0] as [string, Blob];
    expect(JSON.parse(await blob.text())).toEqual({
      token: "collection-token",
      clipId: "a",
      type: "click",
    });
    Reflect.deleteProperty(navigator, "sendBeacon");
  });
});

describe("PresentationMode drawing", () => {
  beforeEach(() => {
    // jsdom has no canvas backend and no pointer capture; the layer copes with
    // a missing 2D context, so strokes are exercised through the model alone.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  afterEach(() => window.localStorage.clear());

  function toolbar(): HTMLElement | null {
    return screen.queryByRole("toolbar", { name: drawCopy.toolbar });
  }

  function drawButton(): HTMLElement {
    return screen.getByRole("button", { name: drawCopy.toggle });
  }

  function drawDot(): void {
    const canvas = screen.getByRole("img", { name: drawCopy.canvas });
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { button: 0, pointerId: 1 });
  }

  function undoButton(): HTMLElement {
    return screen.getByRole("button", { name: drawCopy.undo });
  }

  function startDrawing(): void {
    fireEvent.click(drawButton());
    fireEvent.click(
      screen.getByRole("button", { name: drawCopy.tools.freehand }),
    );
    drawDot();
    expect(undoButton()).toBeEnabled();
  }

  it("pauses the clip and puts the drawing tools over it", () => {
    render(<PresentationMode items={items} playback="manual" />);
    open();
    expect(toolbar()).toBeNull();

    fireEvent.click(drawButton());

    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(toolbar()).not.toBeNull();
    expect(drawButton()).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: drawCopy.tools.arrow }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: drawCopy.width(drawCopy.widths.thick),
      }),
    ).toBeInTheDocument();
    // Drawings stay on screen: nothing to save or download here.
    expect(
      screen.queryByRole("button", { name: drawCopy.export }),
    ).not.toBeInTheDocument();
    // The native bar would sit in the drawing.
    expect(document.querySelector("video")).not.toHaveAttribute("controls");
  });

  it("toggles the drawing with D", () => {
    render(<PresentationMode items={items} playback="manual" />);
    open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "d" });
    expect(toolbar()).not.toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "d" });
    expect(toolbar()).toBeNull();
  });

  it("does not listen for D before the presentation opens", () => {
    render(<PresentationMode items={items} playback="manual" />);
    fireEvent.keyDown(window, { key: "d" });
    open();
    expect(toolbar()).toBeNull();
  });

  it("discards the drawing once the clip plays on", () => {
    render(<PresentationMode items={items} playback="manual" />);
    open();
    startDrawing();

    fireEvent.play(document.querySelector("video") as HTMLVideoElement);

    expect(toolbar()).toBeNull();
    fireEvent.click(drawButton());
    expect(undoButton()).toBeDisabled();
  });

  it.each([
    [
      "the next button",
      () =>
        fireEvent.click(
          screen.getByRole("button", {
            name: presentationContent.transport.next,
          }),
        ),
    ],
    [
      "arrow-right",
      () =>
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" }),
    ],
  ])("discards the drawing when %s moves to the next clip", (_, next) => {
    render(<PresentationMode items={items} playback="manual" />);
    open();
    startDrawing();

    next();

    expect(
      screen.getByText(presentationContent.counter(2, 3)),
    ).toBeInTheDocument();
    expect(toolbar()).toBeNull();
    fireEvent.click(drawButton());
    expect(undoButton()).toBeDisabled();
  });

  it("closes the drawing, not the presentation, on the first Escape", () => {
    render(<PresentationMode items={items} playback="manual" />);
    open();
    fireEvent.click(drawButton());

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(toolbar()).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("PresentationMode in native fullscreen", () => {
  let fullscreenElement: Element | null = null;

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    // Only the presentation overlay ever asks for the screen here.
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

  function leaveFullscreen(): void {
    fullscreenElement = null;
    fireEvent(document, new Event("fullscreenchange"));
  }

  it("takes the screen on open and closes when fullscreen is left", () => {
    render(<PresentationMode items={items} />);
    open();
    expect(fullscreenElement).toBe(screen.getByRole("dialog"));

    leaveFullscreen();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("only closes the drawing when fullscreen is left while drawing", () => {
    render(<PresentationMode items={items} playback="manual" />);
    open();
    fireEvent.click(screen.getByRole("button", { name: drawCopy.toggle }));

    leaveFullscreen();

    expect(
      screen.queryByRole("toolbar", { name: drawCopy.toolbar }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
