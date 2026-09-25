import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commentsContent } from "@/features/clips/comments/content";
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
  vi.unstubAllGlobals();
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

describe("PlaylistPlayer comments", () => {
  it("mounts no comment thread unless asked to", () => {
    render(<PlaylistPlayer items={items} />);
    expect(
      screen.queryByRole("region", { name: commentsContent.regionLabel }),
    ).not.toBeInTheDocument();
  });

  it("loads the current clip's comments with the share token and follows the playlist", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ comments: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<PlaylistPlayer items={items} comments={{ shareToken: "tok" }} />);

    expect(
      screen.getByRole("region", { name: commentsContent.regionLabel }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/clips/a/comments?shareToken=tok",
      ),
    );

    fireEvent.click(screen.getByLabelText(playlistContent.transport.next));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/clips/b/comments?shareToken=tok",
      ),
    );
  });
});

describe("PlaylistPlayer playback modes", () => {
  function activeTitle() {
    return screen
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-current") === "true");
  }

  function video() {
    const element = document.querySelector("video");
    if (!element) throw new Error("no video element");
    return element;
  }

  it("auto-advances and starts the next clip in continuous playback", () => {
    render(<PlaylistPlayer items={items} />);
    fireEvent.ended(video());
    expect(activeTitle()).toHaveTextContent("Ecke kurz");

    fireEvent.loadedData(video());
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("does not start a clip the viewer switches to in manual playback", () => {
    render(<PlaylistPlayer items={items} playback="manual" />);
    fireEvent.click(screen.getByText("Ecke kurz"));
    fireEvent.loadedData(video());
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("stops on a finished clip and offers replay and next in manual playback", () => {
    render(<PlaylistPlayer items={items} playback="manual" />);
    fireEvent.ended(video());

    expect(activeTitle()).toHaveTextContent("Tor");
    expect(screen.getByText(playlistContent.ended)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: playlistContent.transport.replay }),
    );
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    fireEvent.play(video());
    expect(screen.queryByText(playlistContent.ended)).not.toBeInTheDocument();

    fireEvent.ended(video());
    const endCard = screen.getByRole("group", { name: playlistContent.ended });
    fireEvent.click(
      within(endCard).getByRole("button", {
        name: playlistContent.transport.next,
      }),
    );
    expect(activeTitle()).toHaveTextContent("Ecke kurz");
    expect(screen.queryByText(playlistContent.ended)).not.toBeInTheDocument();
  });

  it("offers only replay when the last clip ends in manual playback", () => {
    render(<PlaylistPlayer items={items} playback="manual" />);
    fireEvent.click(screen.getByText("Aktion gut"));
    fireEvent.ended(video());

    const endCard = screen.getByRole("group", { name: playlistContent.ended });
    expect(
      within(endCard).getByRole("button", {
        name: playlistContent.transport.replay,
      }),
    ).toBeInTheDocument();
    expect(
      within(endCard).queryByRole("button", {
        name: playlistContent.transport.next,
      }),
    ).not.toBeInTheDocument();
  });

  it("counts views against the collection link only when asked to", async () => {
    const beacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: beacon,
      configurable: true,
    });

    const { unmount } = render(
      <PlaylistPlayer items={items} playback="manual" />,
    );
    fireEvent.play(video());
    expect(beacon).not.toHaveBeenCalled();
    unmount();

    render(
      <PlaylistPlayer
        items={items}
        playback="manual"
        views={{ shareToken: "collection-token" }}
      />,
    );
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
