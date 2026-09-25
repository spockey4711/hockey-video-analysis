import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContinuousPlayer, playerContent } from "@/features/player";
import type { PlayerSource } from "@/features/player";
import { telestrationContent as copy } from "@/features/player/telestration";

let pause: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get: () => 0,
    set: () => {},
  });
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn<() => void>();
  window.HTMLMediaElement.prototype.pause = pause;
  // jsdom has no canvas backend and no pointer capture; the layer copes with a
  // missing 2D context, so drawing is exercised through the model alone.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  HTMLElement.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const sources: PlayerSource[] = [
  { src: "https://media.test/a.mp4", durationS: 250, label: "a.mp4" },
];

function renderPlayer() {
  return render(<ContinuousPlayer sources={sources} title="Spiel" />);
}

function toolbar(): HTMLElement | null {
  return screen.queryByRole("toolbar", { name: copy.toolbar });
}

function drawButton(): HTMLElement {
  return screen.getByRole("button", { name: copy.toggle });
}

function drawDot(): void {
  const canvas = screen.getByRole("img", { name: copy.canvas });
  fireEvent.pointerDown(canvas, { button: 0, pointerId: 1 });
  fireEvent.pointerUp(canvas, { button: 0, pointerId: 1 });
}

describe("telestration on the watch player", () => {
  it("pauses on a still and puts the drawing layer up on D", () => {
    renderPlayer();
    expect(toolbar()).toBeNull();

    fireEvent.keyDown(window, { key: "d" });

    expect(pause).toHaveBeenCalled();
    expect(toolbar()).not.toBeNull();
    expect(screen.getByRole("img", { name: copy.canvas })).toBeTruthy();
    expect(drawButton().getAttribute("aria-pressed")).toBe("true");
    // The paused badge steps aside so it does not sit in the drawing.
    expect(
      screen.queryByRole("status", { name: playerContent.status.paused }),
    ).toBeNull();
  });

  it("toggles from the transport switch", () => {
    renderPlayer();
    fireEvent.click(drawButton());
    expect(toolbar()).not.toBeNull();
    fireEvent.click(drawButton());
    expect(toolbar()).toBeNull();
  });

  it("closes on Escape and from its own close button", () => {
    renderPlayer();
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(toolbar()).toBeNull();

    fireEvent.keyDown(window, { key: "d" });
    fireEvent.click(screen.getByRole("button", { name: copy.close }));
    expect(toolbar()).toBeNull();
  });

  it.each(["play", "seeking", "emptied"])(
    "discards the drawing once the frame moves (%s)",
    (type) => {
      const { container } = renderPlayer();
      fireEvent.keyDown(window, { key: "d" });
      const video = container.querySelector("video");
      if (!video) throw new Error("no video rendered");

      fireEvent(video, new Event(type));

      expect(toolbar()).toBeNull();
    },
  );

  it("takes back the last stroke with the undo button and Ctrl+Z", () => {
    renderPlayer();
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.click(screen.getByRole("button", { name: copy.tools.freehand }));
    const undo = screen.getByRole("button", { name: copy.undo });
    expect(undo).toHaveProperty("disabled", true);

    drawDot();
    drawDot();
    expect(undo).toHaveProperty("disabled", false);

    fireEvent.click(undo);
    expect(undo).toHaveProperty("disabled", false);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(undo).toHaveProperty("disabled", true);
  });

  it("marks the picked tool and pen as pressed", () => {
    renderPlayer();
    fireEvent.keyDown(window, { key: "d" });
    const circle = screen.getByRole("button", { name: copy.tools.circle });
    const blue = screen.getByRole("button", {
      name: copy.color(copy.colors.blue),
    });

    fireEvent.click(circle);
    fireEvent.click(blue);

    expect(circle.getAttribute("aria-pressed")).toBe("true");
    expect(blue.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen
        .getByRole("button", { name: copy.tools.arrow })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("picks the stroke width by button and steps it with W", () => {
    renderPlayer();
    fireEvent.keyDown(window, { key: "d" });
    const widthButton = (name: string) =>
      screen.getByRole("button", { name: copy.width(name) });
    const pressed = (name: string) =>
      widthButton(name).getAttribute("aria-pressed");
    expect(pressed(copy.widths.medium)).toBe("true");

    fireEvent.click(widthButton(copy.widths.thin));
    expect(pressed(copy.widths.thin)).toBe("true");
    expect(pressed(copy.widths.medium)).toBe("false");

    fireEvent.keyDown(window, { key: "w" });
    expect(pressed(copy.widths.medium)).toBe("true");
    fireEvent.keyDown(window, { key: "w" });
    fireEvent.keyDown(window, { key: "w" });
    expect(pressed(copy.widths.thin)).toBe("true");
  });

  it("remembers the last stroke width for the next player", () => {
    const first = renderPlayer();
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.click(
      screen.getByRole("button", { name: copy.width(copy.widths.thick) }),
    );
    first.unmount();

    renderPlayer();
    fireEvent.keyDown(window, { key: "d" });
    expect(
      screen
        .getByRole("button", { name: copy.width(copy.widths.thick) })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("explains an export while the frame is not loaded yet", async () => {
    renderPlayer();
    fireEvent.keyDown(window, { key: "d" });

    fireEvent.click(screen.getByRole("button", { name: copy.export }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      copy.errors["no-frame"],
    );
  });
});
