import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClipBoardProvider, WatchTagsRail } from "@/components/watch";
import { ContinuousPlayer, type PlayerSource } from "@/features/player";
import { GameTagsProvider } from "@/features/tagging";
import type { EditableTag } from "@/features/tagging/edit/queries";

const gameId = "11111111-1111-4111-8111-111111111111";
const goalTag: EditableTag = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  type: "goal",
  startS: 90,
  endS: 105,
  visibility: "team",
};

// jsdom does not implement media playback; stub what the controller reads.
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
  // Route by method: the clip provider reads status (GET) on mount; a tag edit
  // (PATCH) echoes back the updated row; delete (DELETE) just succeeds.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body =
        method === "PATCH"
          ? { tag: { ...goalTag, endS: 110 } }
          : method === "GET"
            ? { clips: [] }
            : {};
      return { ok: true, status: 200, json: async () => body };
    }) as unknown as typeof fetch,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sources: PlayerSource[] = [
  { src: "https://media.test/a.mp4", durationS: 300, label: "a.mp4" },
];

function renderRail(initialTags: EditableTag[]) {
  render(
    <GameTagsProvider initialTags={initialTags}>
      <ClipBoardProvider gameId={gameId}>
        <ContinuousPlayer
          sources={sources}
          title="HSV"
          aside={<WatchTagsRail roster={[]} />}
        />
      </ClipBoardProvider>
    </GameTagsProvider>,
  );
}

describe("WatchTagsRail", () => {
  it("shows an empty state and no detail until a tag exists", () => {
    renderRail([]);
    expect(screen.getByText("Noch keine Tags")).toBeInTheDocument();
    expect(screen.getByText(/Wähle einen Tag/)).toBeInTheDocument();
  });

  it("counts tags in the header", () => {
    renderRail([goalTag]);
    expect(screen.getByText("Tags . 1")).toBeInTheDocument();
  });

  it("opens the detail when a tag row is selected", () => {
    renderRail([goalTag]);

    // No detail fields until a row is picked.
    expect(screen.queryByText("Start")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Tor bei 1:30 auswählen/ }),
    );

    // The detail exposes the window and the edit/delete actions.
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Ende")).toBeInTheDocument();
    expect(screen.getByText("Bearbeiten")).toBeInTheDocument();
  });

  it("edits the selected tag's window from the live game time", async () => {
    renderRail([goalTag]);
    fireEvent.click(
      screen.getByRole("button", { name: /Tor bei 1:30 auswählen/ }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));
    // Stamp the end from the live player time, then save.
    currentTime = 110;
    fireEvent.click(screen.getByRole("button", { name: "Ende: Jetzt" }));
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => {
      const patch = vi
        .mocked(fetch)
        .mock.calls.find(
          (call) => (call[1] as RequestInit)?.method === "PATCH",
        );
      expect(patch).toBeDefined();
      expect(JSON.parse((patch![1] as RequestInit).body as string)).toEqual({
        type: "goal",
        startS: 90,
        endS: 110,
      });
    });
  });

  it("clears the detail after the selected tag is deleted", async () => {
    renderRail([goalTag]);
    fireEvent.click(
      screen.getByRole("button", { name: /Tor bei 1:30 auswählen/ }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Löschen" }));
    fireEvent.click(screen.getByRole("button", { name: "Ja, löschen" }));

    await waitFor(() =>
      expect(screen.getByText("Noch keine Tags")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
  });
});
