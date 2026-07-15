import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TagPlayersEditor } from "@/features/tag-players";
import type { RosterPlayer } from "@/features/tag-players";
import type { TagPlayers } from "@/features/tag-players";

const tagId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const anna = "11111111-1111-4111-8111-111111111111";
const ben = "22222222-2222-4222-8222-222222222222";

const roster: RosterPlayer[] = [
  { id: anna, name: "Anna Adams", jerseyNumber: 7 },
  { id: ben, name: "Ben Bauer", jerseyNumber: 9 },
];

/** Mock `fetch`: GET returns `current`, PUT echoes the submitted body back. */
function stubFetch(current: TagPlayers) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const tagPlayers = JSON.parse(init.body as string) as TagPlayers;
      return { ok: true, status: 200, json: async () => ({ tagPlayers }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ tagPlayers: current }),
    };
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TagPlayersEditor", () => {
  it("loads the current links, adds a player, and saves via PUT", async () => {
    const fetchMock = stubFetch({ visibility: "team", playerIds: [anna] });
    const onSaved = vi.fn();

    render(
      <TagPlayersEditor
        tagId={tagId}
        roster={roster}
        initialVisibility="team"
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );

    // The current link (Anna) is pre-checked once the GET resolves.
    const annaBox = () =>
      screen.getByRole("checkbox", { name: /Anna Adams/ }) as HTMLInputElement;
    await waitFor(() => expect(annaBox().checked).toBe(true));
    expect(
      (screen.getByRole("checkbox", { name: /Ben Bauer/ }) as HTMLInputElement)
        .checked,
    ).toBe(false);

    // Add Ben and save.
    fireEvent.click(screen.getByRole("checkbox", { name: /Ben Bauer/ }));
    fireEvent.click(screen.getByText("Speichern"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    const putCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "PUT",
    );
    expect(putCall?.[0]).toBe(`/api/tags/${tagId}/players`);
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({
      visibility: "team",
      playerIds: [anna, ben],
    });
  });

  it("blocks saving a single tag with no player selected", async () => {
    stubFetch({ visibility: "team", playerIds: [] });

    render(
      <TagPlayersEditor
        tagId={tagId}
        roster={roster}
        initialVisibility="team"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Speichern")).not.toBeDisabled(),
    );

    // Switch to single visibility with no player: save is blocked and the
    // invariant is explained.
    fireEvent.click(screen.getByRole("button", { name: "Einzeln" }));
    expect(screen.getByText("Speichern")).toBeDisabled();
    expect(
      screen.getByText(/braucht mindestens einen Spieler/),
    ).toBeInTheDocument();

    // Picking a player unblocks it.
    fireEvent.click(screen.getByRole("checkbox", { name: /Anna Adams/ }));
    expect(screen.getByText("Speichern")).not.toBeDisabled();
  });

  it("shows an empty-roster message when there are no players", async () => {
    stubFetch({ visibility: "team", playerIds: [] });

    render(
      <TagPlayersEditor
        tagId={tagId}
        roster={[]}
        initialVisibility="team"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      await screen.findByText("Noch keine Spieler angelegt."),
    ).toBeInTheDocument();
  });
});
