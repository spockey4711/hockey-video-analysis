import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContinuousPlayer, type PlayerSource } from "@/features/player";
import { GameTagsProvider, TaggingPanel } from "@/features/tagging";
import type { EditableTag } from "@/features/tagging/edit/queries";

const gameId = "11111111-1111-4111-8111-111111111111";
const goalTag: EditableTag = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  type: "goal",
  startS: 90,
  endS: 105,
  visibility: "team",
};
const actionTag: EditableTag = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  type: "action_good",
  startS: 200,
  endS: 214,
  visibility: "team",
};

const sources: PlayerSource[] = [
  { src: "https://media.test/a.mp4", durationS: 300, label: "a.mp4" },
];

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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPanel(initialTags: EditableTag[]) {
  return render(
    <GameTagsProvider initialTags={initialTags}>
      <ContinuousPlayer
        sources={sources}
        title="HSV"
        aside={<TaggingPanel gameId={gameId} />}
      />
    </GameTagsProvider>,
  );
}

/**
 * The tag-list panel, scoped away from the hotkey legend - which also lists tag
 * labels like "Tor" - so queries never collide with it.
 */
function list() {
  return within(screen.getByRole("region", { name: "Erfasste Tags" }));
}

/** The `<li>` row whose chip carries `label`, within the tag-list panel. */
function rowFor(label: string): HTMLElement {
  const row = list().getByText(label).closest("li");
  if (!row) throw new Error(`no tag row for ${label}`);
  return row;
}

describe("TagList", () => {
  it("lists captured tags in start order with their clip window", () => {
    renderPanel([actionTag, goalTag]);

    const rows = list().getAllByRole("listitem");
    // The goal (startS 90) sorts before the action (startS 200).
    expect(within(rows[0]).getByText("Tor")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/1:30 - 1:45/)).toBeInTheDocument();
    expect(within(rows[1]).getByText("Aktion gut")).toBeInTheDocument();
  });

  it("shows the empty state when no tags exist", () => {
    renderPanel([]);
    expect(screen.getByText("Noch keine Tags erfasst.")).toBeInTheDocument();
  });

  it("edits a tag's type and window via PATCH and reflects the result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tag: {
            id: goalTag.id,
            type: "action_bad",
            startS: 95,
            endS: 105,
            visibility: "team",
          },
        }),
      })) as unknown as typeof fetch,
    );

    renderPanel([goalTag]);

    fireEvent.click(within(rowFor("Tor")).getByText("Bearbeiten"));

    // Retype and re-stamp the start from the live player time (95s), which stays
    // before the 105s end so the window is valid.
    fireEvent.change(screen.getByLabelText("Tag-Typ"), {
      target: { value: "action_bad" },
    });
    currentTime = 95;
    fireEvent.click(screen.getByText("Start: Jetzt"));
    fireEvent.click(screen.getByText("Speichern"));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`/api/tags/${goalTag.id}`);
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(init?.body as string)).toEqual({
      type: "action_bad",
      startS: 95,
      endS: 105,
    });

    // The row now carries the persisted type.
    await waitFor(() =>
      expect(list().getByText("Aktion schlecht")).toBeInTheDocument(),
    );
  });

  it("deletes a tag via DELETE after confirmation and drops the row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 204 })) as unknown as typeof fetch,
    );

    renderPanel([goalTag, actionTag]);

    fireEvent.click(within(rowFor("Tor")).getByText("Löschen"));
    fireEvent.click(screen.getByText("Ja, löschen"));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`/api/tags/${goalTag.id}`);
    expect(init?.method).toBe("DELETE");

    await waitFor(() =>
      expect(list().queryByText("Tor")).not.toBeInTheDocument(),
    );
    // The other tag stays.
    expect(list().getByText("Aktion gut")).toBeInTheDocument();
  });

  it("surfaces an error and keeps the row when a delete fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
      })) as unknown as typeof fetch,
    );

    renderPanel([goalTag]);

    fireEvent.click(within(rowFor("Tor")).getByText("Löschen"));
    fireEvent.click(screen.getByText("Ja, löschen"));

    await waitFor(() =>
      expect(
        screen.getByText("Der Tag konnte nicht gelöscht werden."),
      ).toBeInTheDocument(),
    );
    expect(list().getByText("Tor")).toBeInTheDocument();
  });
});
