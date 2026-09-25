import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stageContent } from "@/features/clip-edits/stage/content";
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
  it("shows the coach comment under the current clip's title, clamped to two lines", () => {
    const withNote: PlaylistItem[] = [
      { ...items[0], coachComment: "Früher abspielen." },
      items[1],
    ];
    render(<PlaylistPlayer items={withNote} />);

    const note = screen.getByText("Früher abspielen.", { exact: false });
    expect(note).toHaveTextContent(
      `${commentsContent.coachLabel}: Früher abspielen.`,
    );
    expect(note).toHaveClass("line-clamp-2");
    expect(note).toHaveAttribute("title", "Früher abspielen.");

    // A clip without a coach comment looks as before.
    fireEvent.click(
      screen.getByRole("button", { name: playlistContent.transport.next }),
    );
    expect(screen.queryByText(`${commentsContent.coachLabel}:`)).toBeNull();
    expect(
      screen.queryByText("Früher abspielen.", { exact: false }),
    ).toBeNull();
  });

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

describe("PlaylistPlayer loading ahead", () => {
  const session: PlaylistItem[] = [
    ...items,
    { id: "d", src: "/d.mp4", title: "Aktion schlecht" },
  ];

  function videos() {
    return Array.from(document.querySelectorAll("video"));
  }

  function sources() {
    return videos().map((video) => video.getAttribute("src"));
  }

  function stubBeacon() {
    const beacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: beacon,
      configurable: true,
    });
    return beacon;
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, "sendBeacon");
    Reflect.deleteProperty(navigator, "connection");
  });

  it("loads the next two clips in hidden elements once the current one has a frame", () => {
    render(<PlaylistPlayer items={session} />);
    expect(sources()).toEqual(["/a.mp4"]);

    fireEvent.loadedData(videos()[0]);
    expect(sources()).toEqual(["/a.mp4", "/b.mp4", "/c.mp4"]);
    const [current, ...ahead] = videos();
    expect(current).toHaveAttribute("controls");
    for (const video of ahead) {
      expect(video).toHaveAttribute("preload", "auto");
      expect(video).toHaveClass("hidden");
      expect(video).not.toHaveAttribute("controls");
    }
  });

  it("shows the element that loaded ahead and keeps nothing behind", () => {
    render(<PlaylistPlayer items={session} playback="manual" />);
    fireEvent.loadedData(videos()[0]);
    const loadedAhead = videos()[1];

    fireEvent.click(
      screen.getByRole("button", { name: playlistContent.transport.next }),
    );
    expect(videos()[0]).toBe(loadedAhead);
    expect(loadedAhead).toHaveAttribute("controls");

    fireEvent.loadedData(loadedAhead);
    expect(sources()).toEqual(["/b.mp4", "/c.mp4", "/d.mp4"]);

    // A jump back drops what is no longer ahead and starts over from there.
    fireEvent.click(screen.getByText("Tor"));
    expect(sources()).toEqual(["/a.mp4"]);
    expect(videos()[0]).not.toBe(loadedAhead);
  });

  it("starts a clip that loaded ahead as it comes up in continuous playback", () => {
    render(<PlaylistPlayer items={session} />);
    fireEvent.loadedData(videos()[0]);
    Object.defineProperty(videos()[1], "readyState", {
      value: HTMLMediaElement.HAVE_ENOUGH_DATA,
    });

    fireEvent.ended(videos()[0]);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("loads only metadata ahead when the viewer saves data", () => {
    Object.defineProperty(navigator, "connection", {
      value: Object.assign(new EventTarget(), { saveData: true }),
      configurable: true,
    });
    render(<PlaylistPlayer items={session} />);
    fireEvent.loadedData(videos()[0]);

    expect(videos().slice(1)).toHaveLength(2);
    for (const video of videos().slice(1)) {
      expect(video).toHaveAttribute("preload", "metadata");
    }
  });

  it("never counts a view for a clip that only loaded ahead", async () => {
    const beacon = stubBeacon();
    render(
      <PlaylistPlayer
        items={session}
        playback="manual"
        views={{ shareToken: "collection-token" }}
      />,
    );
    fireEvent.loadedData(videos()[0]);

    for (const video of videos().slice(1)) {
      fireEvent.loadedData(video);
      fireEvent.play(video);
      fireEvent.timeUpdate(video);
      fireEvent.seeked(video);
      fireEvent.ended(video);
    }
    expect(beacon).not.toHaveBeenCalled();

    // Once the viewer moves on and plays it, it counts like any clip.
    fireEvent.click(
      screen.getByRole("button", { name: playlistContent.transport.next }),
    );
    fireEvent.play(videos()[0]);
    expect(beacon).toHaveBeenCalledOnce();
    const [, blob] = beacon.mock.calls[0] as [string, Blob];
    expect(JSON.parse(await blob.text())).toEqual({
      token: "collection-token",
      clipId: "b",
      type: "click",
    });
  });
});

describe("PlaylistPlayer with edited clips", () => {
  const plan = {
    inS: 2,
    outS: 8,
    slow: [],
    zoom: [],
    marks: [],
    exact: true,
    trimClamped: false,
  };
  const edited: PlaylistItem[] = items.map((item) => ({ ...item, plan }));

  function video() {
    const element = document.querySelector("video");
    if (!element) throw new Error("no video element");
    return element;
  }

  it("plays a clip with a plan on the stage, without native controls", () => {
    render(<PlaylistPlayer items={edited} playback="manual" />);
    expect(video()).not.toHaveAttribute("controls");
    expect(
      screen.getByRole("slider", { name: stageContent.scrub }),
    ).toBeInTheDocument();
    fireEvent.loadedMetadata(video());
    expect(video().currentTime).toBe(2);
  });

  it("offers replay and next at the end, and replays from the in point", () => {
    render(<PlaylistPlayer items={edited} playback="manual" />);
    video().currentTime = 8;
    fireEvent.ended(video());

    const endCard = screen.getByRole("group", { name: playlistContent.ended });
    fireEvent.click(
      within(endCard).getByRole("button", {
        name: playlistContent.transport.replay,
      }),
    );
    expect(video().currentTime).toBe(2);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("counts a view of the window, not of the whole file", async () => {
    const beacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: beacon,
      configurable: true,
    });
    render(
      <PlaylistPlayer
        items={edited}
        playback="manual"
        views={{ shareToken: "collection-token" }}
      />,
    );
    Object.defineProperty(video(), "duration", { value: 30 });
    video().currentTime = 2;
    fireEvent.play(video());
    for (let t = 2.25; t <= 7.5; t += 0.25) {
      video().currentTime = t;
      fireEvent.timeUpdate(video());
    }
    const types = await Promise.all(
      beacon.mock.calls.map(
        async ([, blob]) =>
          (JSON.parse(await (blob as Blob).text()) as { type: string }).type,
      ),
    );
    expect(types).toEqual(["click", "full_view"]);
    Reflect.deleteProperty(navigator, "sendBeacon");
  });

  it("offers a markers switch that hides them for the whole visit", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const marked: PlaylistItem[] = edited.map((item, index) =>
      index === 1
        ? {
            ...item,
            plan: {
              ...plan,
              marks: [
                {
                  id: "m1",
                  atS: 4,
                  holdS: 2,
                  freeze: true,
                  strokes: [
                    {
                      tool: "circle" as const,
                      color: "red" as const,
                      width: "medium" as const,
                      style: "solid" as const,
                      points: [
                        { x: 0.2, y: 0.2 },
                        { x: 0.4, y: 0.4 },
                      ],
                    },
                  ],
                },
              ],
            },
          }
        : item,
    );
    render(<PlaylistPlayer items={marked} playback="manual" />);
    // Offered on every clip once any clip carries markers.
    const toggle = screen.getByRole("button", {
      name: stageContent.transport.marks,
    });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByLabelText(playlistContent.transport.next));
    expect(screen.getByTestId("marks-overlay")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: stageContent.transport.marks }),
    );
    expect(screen.queryByTestId("marks-overlay")).toBeNull();
    fireEvent.click(screen.getByLabelText(playlistContent.transport.previous));
    fireEvent.click(screen.getByLabelText(playlistContent.transport.next));
    expect(screen.queryByTestId("marks-overlay")).toBeNull();
    expect(
      screen.getByRole("button", { name: stageContent.transport.marks }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("offers no markers switch without markers", () => {
    render(<PlaylistPlayer items={edited} playback="manual" />);
    expect(
      screen.queryByRole("button", { name: stageContent.transport.marks }),
    ).toBeNull();
  });

  it("keeps the team and player links on the browser's controls", () => {
    render(<PlaylistPlayer items={items} />);
    expect(video()).toHaveAttribute("controls");
    expect(screen.queryByRole("slider")).toBeNull();
  });
});
