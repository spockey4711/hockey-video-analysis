import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContinuousPlayer,
  playerContent,
  type PlayerSource,
} from "@/features/player";
import { telestrationContent } from "@/features/player/telestration";
import {
  GameTagsProvider,
  TransportTagButtons,
  taggingContent,
} from "@/features/tagging";

const gameId = "11111111-1111-4111-8111-111111111111";

// jsdom does not implement media playback; stub the bits the player reads so the
// controller can report a real game time to the tag buttons.
let currentTime = 0;
beforeEach(() => {
  currentTime = 0;
  Object.defineProperty(window.HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
  });
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({
        tag: { id: "tag-1", type: "goal", startS: 90, endS: 105 },
      }),
    })) as unknown as typeof fetch,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "fullscreenElement");
});

// One chapter, total 250s.
const sources: PlayerSource[] = [
  {
    src: "https://media.test/a.mp4",
    durationS: 250,
    frameRate: null,
    label: "a.mp4",
  },
];

function renderButtons() {
  return render(
    <GameTagsProvider>
      <ContinuousPlayer
        sources={sources}
        title="HSV"
        tagControls={<TransportTagButtons gameId={gameId} />}
      />
    </GameTagsProvider>,
  );
}

/** Tell the page that the video stage now owns the screen, as a browser would. */
function takeOverScreen(container: HTMLElement): void {
  const stage = container.querySelector("video")?.parentElement;
  if (!stage) throw new Error("no video stage rendered");
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: stage,
  });
  fireEvent(document, new Event("fullscreenchange"));
}

/** The persisted window a goal capture at 100s (pre 10 / post 5) resolves to. */
const goalWindow = { gameId, type: "goal", startS: 90, endS: 105 };

describe("TransportTagButtons", () => {
  it("captures live player time on a bound key and posts the window", async () => {
    renderButtons();

    // Move the video to 100s; capture must read this live game time.
    currentTime = 100;
    fireEvent.keyDown(window, { key: "t" });

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toEqual(goalWindow);
  });

  it("captures the same window from a button click", async () => {
    renderButtons();

    currentTime = 100;
    fireEvent.click(screen.getByTitle("Tor (T)"));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toEqual(goalWindow);
  });

  it("ignores a bound key while typing in a field", () => {
    render(
      <GameTagsProvider>
        <ContinuousPlayer
          sources={sources}
          title="HSV"
          tagControls={<TransportTagButtons gameId={gameId} />}
          aside={<input aria-label="note" />}
        />
      </GameTagsProvider>,
    );

    currentTime = 100;
    fireEvent.keyDown(screen.getByLabelText("note"), { key: "t" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("captures once and confirms on screen while the stage is fullscreen", async () => {
    const { container } = renderButtons();
    takeOverScreen(container);

    // The tags rail is off screen up there, so the readout is the only signal.
    expect(screen.getByText(taggingContent.legendHint)).toBeInTheDocument();

    currentTime = 100;
    fireEvent.keyDown(window, { key: "t" });

    // Exactly one POST: moving the buttons onto the stage must not leave a
    // second capture listener bound behind them.
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(
      await screen.findByText(taggingContent.captured("Tor", "1:30")),
    ).toBeInTheDocument();
  });
});

/**
 * jsdom has no layout, so this pins the wrapping contract that keeps the
 * transport row inside the video column (P2-19): with the full set of tag
 * buttons the row needs about 1070px, more than the column at laptop widths,
 * and a single unwrapped line pushed the draw and fullscreen switches past the
 * workspace's clipped edge.
 */
describe("transport row at narrow widths", () => {
  it("wraps so the draw and fullscreen switches stay reachable", () => {
    renderButtons();

    const pen = screen.getByRole("button", {
      name: telestrationContent.toggle,
    });
    const fullscreen = screen.getByRole("button", {
      name: playerContent.fullscreen.enter,
    });
    const tagList = screen.getByRole("list", {
      name: taggingContent.legendTitle,
    });

    // The tag buttons, the pen and the fullscreen switch share one group, which
    // wraps onto its own line flush right instead of running off the edge.
    const group = pen.parentElement!;
    expect(group).toContainElement(fullscreen);
    expect(group).toContainElement(tagList);
    expect(group).toHaveClass("ms-auto", "flex-wrap", "justify-end");

    const row = group.parentElement!;
    expect(row).toHaveClass("flex-wrap");
    expect(
      within(row).getByRole("button", { name: playerContent.transport.play }),
    ).toBeInTheDocument();
    // The clock stays on one line rather than being squeezed into a column.
    expect(within(row).getByText("0:00 / 4:10")).toHaveClass(
      "whitespace-nowrap",
    );

    // A column narrower than the whole tag set wraps the tags themselves.
    expect(tagList).toHaveClass("flex-wrap");
  });
});
