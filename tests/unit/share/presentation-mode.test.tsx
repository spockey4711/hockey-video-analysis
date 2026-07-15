import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
