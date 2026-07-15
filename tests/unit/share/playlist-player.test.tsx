import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlaylistPlayer } from "@/features/share/playlist/PlaylistPlayer";
import { playlistContent } from "@/features/share/playlist/content";
import type { PlaylistItem } from "@/features/share/playlist/types";

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

describe("PlaylistPlayer", () => {
  it("renders nothing for an empty list", () => {
    const { container } = render(<PlaylistPlayer items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("starts on the first clip, marked as current", () => {
    render(<PlaylistPlayer items={items} />);
    const active = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-current") === "true");
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent("Tor");
  });

  it("advances to the next clip via the next control", () => {
    render(<PlaylistPlayer items={items} />);
    fireEvent.click(screen.getByLabelText(playlistContent.transport.next));

    const active = screen
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-current") === "true");
    expect(active).toHaveTextContent("Ecke kurz");
  });

  it("jumps to a clip clicked in the playlist", () => {
    render(<PlaylistPlayer items={items} />);
    fireEvent.click(screen.getByText("Aktion gut"));

    const active = screen
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-current") === "true");
    expect(active).toHaveTextContent("Aktion gut");
  });

  it("disables previous on the first clip and next on the last", () => {
    render(<PlaylistPlayer items={items} />);
    expect(
      screen.getByLabelText(playlistContent.transport.previous),
    ).toBeDisabled();

    fireEvent.click(screen.getByText("Aktion gut"));
    expect(
      screen.getByLabelText(playlistContent.transport.next),
    ).toBeDisabled();
  });
});
