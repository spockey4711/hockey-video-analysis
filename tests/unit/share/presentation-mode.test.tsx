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

describe("PresentationMode laser pointer", () => {
  function pointerButton(): HTMLElement {
    return screen.getByRole("button", { name: presentationContent.pointer });
  }

  function drawButton(): HTMLElement {
    return screen.getByRole("button", { name: drawCopy.toggle });
  }

  function pointer(): HTMLElement | null {
    return screen.queryByTestId("laser-pointer");
  }

  function drawToolbar(): HTMLElement | null {
    return screen.queryByRole("toolbar", { name: drawCopy.toolbar });
  }

  it("is off until switched on by its button, and off again on a second press", () => {
    render(<PresentationMode items={items} />);
    open();
    expect(pointer()).toBeNull();
    expect(pointerButton()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(pointerButton());
    expect(pointer()).not.toBeNull();
    expect(pointerButton()).toHaveAttribute("aria-pressed", "true");
    // The dot never takes a click from the video or its controls.
    expect(pointer()).toHaveClass("pointer-events-none");
    expect(pointer()?.parentElement).toHaveClass("cursor-none");

    fireEvent.click(pointerButton());
    expect(pointer()).toBeNull();
    expect(screen.getByRole("dialog").querySelector(".cursor-none")).toBeNull();
  });

  it("toggles with P but not with Ctrl+P", () => {
    render(<PresentationMode items={items} />);
    open();
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "p", ctrlKey: true });
    expect(pointer()).toBeNull();
    fireEvent.keyDown(dialog, { key: "p" });
    expect(pointer()).not.toBeNull();
    fireEvent.keyDown(dialog, { key: "P" });
    expect(pointer()).toBeNull();
  });

  it("does not pause the clip and stays on across clips", () => {
    render(<PresentationMode items={items} />);
    open();
    fireEvent.click(pointerButton());
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(screen.getByText("Ecke kurz")).toBeInTheDocument();
    expect(pointer()).not.toBeNull();
  });

  it("hides once drawing is switched on, and closes the drawing when switched back on", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<PresentationMode items={items} playback="manual" />);
    open();
    fireEvent.click(pointerButton());

    fireEvent.click(drawButton());
    expect(drawToolbar()).not.toBeNull();
    expect(pointer()).toBeNull();
    expect(pointerButton()).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "p" });
    expect(pointer()).not.toBeNull();
    expect(drawToolbar()).toBeNull();
    expect(drawButton()).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "d" });
    expect(drawToolbar()).not.toBeNull();
    expect(pointer()).toBeNull();
  });
});

describe("PresentationMode presenter notes", () => {
  const notes = {
    collection: "Thema heute: kurze Ecken",
    clips: { a: "Läufer rechts", c: "Absicherung hinten" },
  };
  const copy = presentationContent.notes;

  function notesButton() {
    return screen.queryByRole("button", { name: copy.toggle });
  }

  function panel() {
    return screen.queryByRole("complementary", { name: copy.panelLabel });
  }

  it("offers no notes switch and ignores h without notes", () => {
    render(<PresentationMode items={items} />);
    open();

    expect(notesButton()).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "h" });
    expect(panel()).toBeNull();
  });

  it("starts hidden and shows the notes on h or the button", () => {
    render(<PresentationMode items={items} presenterNotes={notes} />);
    open();

    expect(panel()).toBeNull();
    expect(notesButton()).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "h" });
    expect(panel()).not.toBeNull();
    expect(notesButton()).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(notesButton() as HTMLElement);
    expect(panel()).toBeNull();
  });

  it("shows the collection note on the first clip only, and each clip's note", () => {
    render(<PresentationMode items={items} presenterNotes={notes} />);
    open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "H" });

    expect(panel()).toHaveTextContent(notes.collection);
    expect(panel()).toHaveTextContent("Läufer rechts");

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(panel()).not.toHaveTextContent(notes.collection);
    expect(panel()).toHaveTextContent(copy.noClipNote);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(panel()).toHaveTextContent("Absicherung hinten");
  });

  it("leaves the pointer alone when the notes are switched", () => {
    render(<PresentationMode items={items} presenterNotes={notes} />);
    open();
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "p" });
    fireEvent.keyDown(dialog, { key: "h" });

    expect(
      screen.getByRole("button", { name: presentationContent.pointer }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(panel()).not.toBeNull();
  });
});

describe("PresentationMode title cards", () => {
  const INTRO = "Heute: kurze Ecken";
  const noted: PlaylistItem[] = [
    { ...items[0], teamNote: "Auf den Läufer achten" },
    items[1],
    { ...items[2], teamNote: "Absicherung hinten" },
  ];
  const copy = presentationContent.titleCard;

  function video() {
    const element = document.querySelector("video");
    if (!element) throw new Error("no video element");
    return element;
  }

  function card(name: string) {
    return screen.queryByRole("group", { name });
  }

  function continueButton() {
    return screen.getByRole("button", { name: copy.continue });
  }

  it("shows the intro, then the first clip's text, each waiting for Weiter", () => {
    render(<PresentationMode items={noted} playback="manual" intro={INTRO} />);
    open();
    fireEvent.loadedData(video());

    expect(card(copy.introLabel)).toHaveTextContent(INTRO);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    fireEvent.click(continueButton());
    expect(card(copy.introLabel)).toBeNull();
    expect(card(copy.clipLabel)).toHaveTextContent("Auf den Läufer achten");
    expect(card(copy.clipLabel)).toHaveTextContent("Tor");

    fireEvent.click(continueButton());
    expect(card(copy.clipLabel)).toBeNull();
    // Manual playback: past the cards, the clip still waits for play.
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("plays straight from a card, skipping the rest", () => {
    render(<PresentationMode items={noted} playback="manual" intro={INTRO} />);
    open();

    fireEvent.click(
      screen.getByRole("button", { name: presentationContent.transport.play }),
    );

    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(card(copy.introLabel)).toBeNull();
    expect(card(copy.clipLabel)).toBeNull();
  });

  it("steps past a card with Enter on the overlay", () => {
    render(<PresentationMode items={noted} playback="manual" />);
    open();
    const dialog = screen.getByRole("dialog");

    expect(card(copy.clipLabel)).not.toBeNull();
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(card(copy.clipLabel)).toBeNull();
  });

  it("shows a clip's card each time it comes up, and none for a clip without a text", () => {
    render(<PresentationMode items={noted} playback="manual" intro={INTRO} />);
    open();
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(card(copy.introLabel)).toBeNull();
    expect(card(copy.clipLabel)).toBeNull();

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(card(copy.clipLabel)).toHaveTextContent("Absicherung hinten");

    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(card(copy.introLabel)).toHaveTextContent(INTRO);
  });

  it("holds the start behind a card in continuous playback until Weiter", () => {
    render(<PresentationMode items={noted} intro={INTRO} />);
    open();
    fireEvent.loadedData(video());
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    fireEvent.click(continueButton());
    fireEvent.click(continueButton());
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("puts the cards away when drawing starts", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<PresentationMode items={noted} playback="manual" intro={INTRO} />);
    open();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "d" });

    expect(card(copy.introLabel)).toBeNull();
    expect(card(copy.clipLabel)).toBeNull();
  });

  it("shows no card and plays as before without any team notes", () => {
    render(<PresentationMode items={items} />);
    open();
    fireEvent.loadedData(video());

    expect(screen.queryByRole("button", { name: copy.continue })).toBeNull();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });
});
