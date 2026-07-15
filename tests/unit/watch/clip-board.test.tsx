import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClipBoard } from "@/components/watch";
import { GameTagsProvider } from "@/features/tagging";
import type { EditableTag } from "@/features/tagging/edit/queries";

const gameId = "11111111-1111-4111-8111-111111111111";
const tagId = "22222222-2222-4222-8222-222222222222";

const tag: EditableTag = {
  id: tagId,
  type: "goal",
  startS: 90,
  endS: 105,
  visibility: "team",
};

/** Route a mocked fetch by method, so GET reads status and POST enqueues. */
function mockFetch(handlers: {
  get?: () => unknown;
  post?: () => unknown;
}): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body =
        init?.method === "POST" ? handlers.post?.() : handlers.get?.();
      return {
        ok: true,
        status: 200,
        json: async () => body ?? {},
      };
    }) as unknown as typeof fetch,
  );
}

function renderBoard(): void {
  render(
    <GameTagsProvider initialTags={[tag]}>
      <ClipBoard gameId={gameId} />
    </GameTagsProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ClipBoard", () => {
  beforeEach(() => {
    mockFetch({ get: () => ({ clips: [] }) });
  });

  it("offers a cut control for a tag that has no clip yet", async () => {
    renderBoard();

    await waitFor(() =>
      expect(screen.getByText("Clip schneiden")).toBeInTheDocument(),
    );
    // No clip means no status pill.
    expect(screen.queryByText("Bereit")).not.toBeInTheDocument();
  });

  it("enqueues a cut for the tag and shows its returned status", async () => {
    mockFetch({
      get: () => ({ clips: [] }),
      post: () => ({ clip: { id: "clip-1", tagId, status: "pending" } }),
    });
    renderBoard();

    const button = await screen.findByText("Clip schneiden");
    fireEvent.click(button);

    // POST carries exactly the tag id, per the enqueue contract.
    await waitFor(() => {
      const post = vi
        .mocked(fetch)
        .mock.calls.find((call) => (call[1] as RequestInit)?.method === "POST");
      expect(post).toBeDefined();
      expect(JSON.parse((post![1] as RequestInit).body as string)).toEqual({
        tagId,
      });
    });

    // The queued status surfaces and the cut control drops (clip now live).
    await waitFor(() =>
      expect(screen.getByText("In Warteschlange")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Clip schneiden")).not.toBeInTheDocument();
  });

  it("shows a failed clip's status with a retry control", async () => {
    mockFetch({
      get: () => ({ clips: [{ id: "clip-1", tagId, status: "failed" }] }),
    });
    renderBoard();

    await waitFor(() =>
      expect(screen.getByText("Fehlgeschlagen")).toBeInTheDocument(),
    );
    expect(screen.getByText("Erneut schneiden")).toBeInTheDocument();
  });
});
