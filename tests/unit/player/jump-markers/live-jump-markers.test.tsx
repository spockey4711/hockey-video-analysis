import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContinuousPlayer } from "@/features/player";
import type { PlayerSource } from "@/features/player";
import { LiveJumpMarkerNav } from "@/features/player/jump-markers";
import {
  GameTagsProvider,
  TaggingPanel,
  TransportTagButtons,
} from "@/features/tagging";
import type { EditableTag } from "@/features/tagging/edit/queries";

const gameId = "11111111-1111-4111-8111-111111111111";

// jsdom does not implement media playback; stub the bits the player reads so the
// controller reports a real game time and the nav can seek to a marker.
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
        tag: { id: "tag-new", type: "goal", startS: 90, endS: 105 },
      }),
    })) as unknown as typeof fetch,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sources: PlayerSource[] = [
  { src: "https://media.test/a.mp4", durationS: 2000, label: "a.mp4" },
];

function renderWatch(initialTags: readonly EditableTag[] = []) {
  return render(
    <GameTagsProvider initialTags={initialTags}>
      <ContinuousPlayer
        sources={sources}
        title="HSV"
        tagControls={<TransportTagButtons gameId={gameId} />}
        aside={
          <>
            <TaggingPanel gameId={gameId} />
            <LiveJumpMarkerNav />
          </>
        }
      />
    </GameTagsProvider>,
  );
}

// The marker nav, scoped away from the hotkey legend - which also lists tag
// labels like "Tor" - so queries never collide with it.
function nav() {
  return within(screen.getByRole("region", { name: "Marker" }));
}

describe("live jump markers", () => {
  it("adds a marker to the nav the moment a tag is captured, no reload", async () => {
    renderWatch();

    // The nav starts empty - no tags captured yet.
    expect(nav().getByText(/Noch keine Marker/)).toBeInTheDocument();
    expect(nav().queryByText("Tor")).not.toBeInTheDocument();

    // Capture a goal at 100s via its hotkey; the store update flows to the nav.
    currentTime = 100;
    fireEvent.keyDown(window, { key: "t" });

    await waitFor(() => expect(nav().getByText("Tor")).toBeInTheDocument());
  });

  it("seeds the nav from the tags loaded server-side", () => {
    renderWatch([
      {
        id: "a",
        type: "corner_short",
        startS: 600,
        endS: 610,
        visibility: "team",
      },
    ]);

    expect(nav().getByText("Ecke kurz")).toBeInTheDocument();
  });
});
