import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { telestrationContent as drawCopy } from "@/features/player/telestration";
import type { PlaylistEntry } from "@/features/share/playlist/types";
import { AudienceView } from "@/features/share/presentation/AudienceView";
import { PresentationMode } from "@/features/share/presentation/PresentationMode";
import {
  pointerMessage,
  sessionMessage,
  type AudienceEntry,
  type AudienceState,
} from "@/features/share/presentation/audience-protocol";
import { presentationContent } from "@/features/share/presentation/content";
import { tacticsContent } from "@/features/tactics/content";

/**
 * The two windows of a presentation on a second screen, both rendered here
 * and joined by an in-memory channel that structured-clones every message as
 * a real `BroadcastChannel` does, and logs it.
 */
class FakeBroadcastChannel {
  static open: FakeBroadcastChannel[] = [];
  static log: unknown[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  private closed = false;

  constructor(readonly name: string) {
    FakeBroadcastChannel.open.push(this);
  }

  postMessage(message: unknown): void {
    const data = structuredClone(message);
    FakeBroadcastChannel.log.push(data);
    for (const other of FakeBroadcastChannel.open) {
      if (other === this || other.closed || other.name !== this.name) continue;
      queueMicrotask(() => other.onmessage?.({ data } as MessageEvent));
    }
  }

  close(): void {
    this.closed = true;
  }
}

const SECRET = "GEHEIM";

const items: PlaylistEntry[] = [
  {
    id: "a",
    src: "/a.mp4",
    title: "Tor",
    subtitle: "Spiel 1 - 1:00",
    coachComment: `${SECRET} Kommentar`,
  },
  { id: "b", src: "/b.mp4", title: "Ecke kurz", subtitle: "Spiel 1 - 2:00" },
  { id: "c", src: "/c.mp4", title: "Aktion gut", subtitle: "Spiel 1 - 3:00" },
];

const presenterNotes = {
  collection: `${SECRET} zur Sammlung`,
  clips: { a: `${SECRET} zum Tor`, b: `${SECRET} zur Ecke` },
};

let audienceUrl: string | null = null;
const audienceWindow = {
  closed: false,
  focus: vi.fn(),
  close: vi.fn(),
  moveTo: vi.fn(),
  resizeTo: vi.fn(),
};

beforeEach(() => {
  FakeBroadcastChannel.open = [];
  FakeBroadcastChannel.log = [];
  audienceUrl = null;
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
  vi.spyOn(window, "open").mockImplementation((url) => {
    audienceUrl = String(url);
    return audienceWindow as unknown as Window;
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockReturnValue(undefined);
  // The board reads the screen's orientation; jsdom has no media queries.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.location.hash = "";
});

function renderPresenter() {
  return render(
    <PresentationMode
      items={items}
      playback="manual"
      views={{ shareToken: `tok-${SECRET}` }}
      presenterNotes={presenterNotes}
      tacticsScenes={[{ id: "sc1", name: `${SECRET} Szene` }]}
      intro="Willkommen zur Analyse"
    />,
  );
}

/** Launch on a second screen, and load the audience window it opened. */
async function launchOnSecondScreen() {
  renderPresenter();
  fireEvent.click(
    screen.getByRole("button", {
      name: presentationContent.secondScreen.launch,
    }),
  );
  expect(audienceUrl).toMatch(/^\/share\/present#[0-9a-f]{32}$/);
  return openAudience();
}

async function openAudience() {
  window.location.hash = new URL(audienceUrl!, "http://localhost").hash;
  const view = render(<AudienceView />);
  const audience = view.container;
  await waitFor(() =>
    expect(
      within(audience).queryByText(presentationContent.audience.waiting),
    ).toBeNull(),
  );
  return view;
}

function presenter() {
  return screen.getByRole("dialog", {
    name: presentationContent.regionLabel,
  });
}

describe("presentation on a second screen", () => {
  it("never sends the notes, the scene list or the share token", async () => {
    const { container: audience } = await launchOnSecondScreen();
    // The intro card is on the projector ...
    expect(
      within(audience).getByText("Willkommen zur Analyse"),
    ).toBeInTheDocument();
    // ... while the notes are only on the laptop, shown from the start.
    const console = within(presenter()).getByRole("complementary", {
      name: presentationContent.console.label,
    });
    expect(within(console).getByText(presenterNotes.collection)).toBeVisible();

    // Step through every clip, with the board and the pointer up once.
    fireEvent.click(
      within(presenter()).getByRole("button", {
        name: presentationContent.board,
      }),
    );
    // The projector shows the board's pitch, drawn read-only.
    await waitFor(() =>
      expect(
        within(audience).getByRole("group", {
          name: tacticsContent.board.pitch,
        }),
      ).toBeInTheDocument(),
    );
    for (let step = 0; step < items.length; step += 1) {
      fireEvent.click(
        within(presenter()).getByRole("button", {
          name: presentationContent.transport.next,
        }),
      );
    }
    await act(async () => {});

    expect(FakeBroadcastChannel.log.length).toBeGreaterThan(3);
    expect(JSON.stringify(FakeBroadcastChannel.log)).not.toContain(SECRET);
    expect(audience.textContent).not.toContain(SECRET);
  });

  it("keeps the projector on the presenter's clip", async () => {
    const { container: audience } = await launchOnSecondScreen();
    // Past the intro card, then on to the second clip.
    fireEvent.click(
      within(presenter()).getByRole("button", {
        name: presentationContent.titleCard.continue,
      }),
    );
    fireEvent.click(
      within(presenter()).getByRole("button", {
        name: presentationContent.transport.next,
      }),
    );
    await waitFor(() =>
      expect(audience.querySelector("video:not(.hidden)")).toHaveAttribute(
        "src",
        "/b.mp4",
      ),
    );
    expect(
      within(audience).queryByRole("button", { name: /Weiter/ }),
    ).toBeNull();
  });

  it("resyncs a reloaded audience window", async () => {
    const first = await launchOnSecondScreen();
    fireEvent.click(
      within(presenter()).getByRole("button", {
        name: presentationContent.titleCard.continue,
      }),
    );
    fireEvent.click(
      within(presenter()).getByRole("button", {
        name: presentationContent.transport.next,
      }),
    );
    first.unmount();
    const { container: audience } = await openAudience();
    expect(audience.querySelector("video:not(.hidden)")).toHaveAttribute(
      "src",
      "/b.mp4",
    );
  });

  it("shows a neutral end when the presentation closes", async () => {
    const { container: audience } = await launchOnSecondScreen();
    fireEvent.click(
      within(presenter()).getByRole("button", {
        name: presentationContent.transport.exit,
      }),
    );
    await waitFor(() =>
      expect(
        within(audience).getByText(presentationContent.audience.ended),
      ).toBeInTheDocument(),
    );
    expect(audience.querySelector("video")).toBeNull();
  });

  it("drives the presenter from the audience window's keys", async () => {
    await launchOnSecondScreen();
    // Next on a title card steps past it, then on to the next clip.
    fireEvent.keyDown(window, { key: "PageDown" });
    await waitFor(() =>
      expect(
        within(presenter()).queryByRole("button", {
          name: presentationContent.titleCard.continue,
        }),
      ).toBeNull(),
    );
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() =>
      expect(
        within(presenter()).getByText(presentationContent.counter(2, 3)),
      ).toBeInTheDocument(),
    );
  });

  it("jumps from the presenter's list", async () => {
    await launchOnSecondScreen();
    const list = within(presenter()).getByRole("navigation", {
      name: presentationContent.console.list,
    });
    fireEvent.click(within(list).getByRole("button", { name: /Aktion gut/ }));
    expect(
      within(presenter()).getByText(presentationContent.counter(3, 3)),
    ).toBeInTheDocument();
    expect(
      within(presenter()).getByText(presentationContent.console.end),
    ).toBeInTheDocument();
  });

  it("goes back to one window, and the notes go with the second screen", async () => {
    await launchOnSecondScreen();
    fireEvent.click(
      within(presenter()).getByRole("button", {
        name: presentationContent.secondScreen.close,
      }),
    );
    expect(audienceWindow.close).toHaveBeenCalled();
    expect(
      within(presenter()).queryByRole("complementary", {
        name: presentationContent.console.label,
      }),
    ).toBeNull();
    expect(
      within(presenter()).queryByText(presenterNotes.collection),
    ).toBeNull();
  });

  it("opens one window without a second screen as before", () => {
    renderPresenter();
    fireEvent.click(
      screen.getByRole("button", { name: presentationContent.launch }),
    );
    expect(window.open).not.toHaveBeenCalled();
    expect(
      within(presenter()).queryByRole("complementary", {
        name: presentationContent.console.label,
      }),
    ).toBeNull();
    expect(FakeBroadcastChannel.log).toEqual([]);
  });
});

describe("AudienceView", () => {
  const sessionId = "0123456789abcdef";

  async function showing(
    state: Partial<AudienceState>,
    entries: readonly AudienceEntry[] = [
      { kind: "clip", id: "a", src: "/a.mp4", title: "Tor" },
    ],
  ) {
    window.location.hash = `#${sessionId}`;
    const view = render(<AudienceView />);
    const presenterEnd = new FakeBroadcastChannel(
      `hva-presentation:${sessionId}`,
    );
    await act(async () => {
      presenterEnd.postMessage(
        sessionMessage(entries, {
          index: 0,
          card: null,
          showMarks: true,
          drawing: null,
          pointer: false,
          board: null,
          media: { playing: false, held: false, time: 0, rate: 1, at: 0 },
          ...state,
        }),
      );
    });
    return { audience: view.container, presenterEnd };
  }

  it("says hello on its channel as it loads", async () => {
    await showing({});
    expect(FakeBroadcastChannel.log[0]).toEqual({ v: 1, type: "hello" });
  });

  it("plays an edited clip without sound or transport too", async () => {
    const { audience } = await showing({}, [
      {
        kind: "clip",
        id: "a",
        src: "/a.mp4",
        title: "Tor",
        plan: {
          inS: 1,
          outS: 5,
          slow: [],
          zoom: [],
          marks: [],
          exact: true,
          trimClamped: false,
        },
      },
    ]);
    expect(audience.querySelector("video")?.muted).toBe(true);
    expect(within(audience).queryAllByRole("button")).toHaveLength(1);
  });

  it("plays without sound and without controls", async () => {
    const { audience } = await showing({});
    const video = audience.querySelector("video");
    expect(video?.muted).toBe(true);
    expect(video).not.toHaveAttribute("controls");
  });

  it("shows the presenter's drawing over the picture", async () => {
    const { audience } = await showing({
      drawing: [
        {
          tool: "circle",
          color: "yellow",
          width: "thick",
          style: "solid",
          points: [
            { x: 0.2, y: 0.2 },
            { x: 0.4, y: 0.5 },
          ],
        },
      ],
    });
    const canvas = within(audience).getByRole("img", {
      name: drawCopy.canvas,
    });
    expect(canvas).toHaveClass("pointer-events-none");
  });

  it("puts the pointer's dot on the same spot of the picture", async () => {
    const { audience, presenterEnd } = await showing({ pointer: true });
    await act(async () => {
      presenterEnd.postMessage(pointerMessage({ x: 0.25, y: 0.75 }));
    });
    const dot = within(audience).getByTestId("audience-pointer")
      .firstElementChild?.firstElementChild as HTMLElement;
    expect(dot.style.left).toBe("25%");
    expect(dot.style.top).toBe("75%");
    await act(async () => {
      presenterEnd.postMessage(pointerMessage(null));
    });
    expect(
      within(audience).getByTestId("audience-pointer").firstElementChild
        ?.firstElementChild,
    ).toBeNull();
  });

  it("asks for a reload when the presenter runs another version", async () => {
    const { audience, presenterEnd } = await showing({});
    await act(async () => {
      presenterEnd.postMessage({ v: 2, type: "end" });
    });
    expect(
      within(audience).getByText(presentationContent.audience.otherVersion),
    ).toBeInTheDocument();
  });
});

describe("AudienceView opened by hand", () => {
  it("says what it is for and shows nothing else", () => {
    render(<AudienceView />);
    expect(
      screen.getByText(presentationContent.audience.unavailable),
    ).toBeInTheDocument();
  });
});
