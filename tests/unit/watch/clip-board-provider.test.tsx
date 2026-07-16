import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StatusBadge } from "@/components/data";
import {
  canEnqueueClip,
  ClipBoardProvider,
  useClipBoard,
} from "@/components/watch";

const gameId = "11111111-1111-4111-8111-111111111111";
const tagId = "22222222-2222-4222-8222-222222222222";

/** A minimal consumer of the shared clip board, mirroring a tag's cut control. */
function ClipProbe() {
  const { byTag, enqueueingTagIds, enqueue } = useClipBoard();
  const clip = byTag.get(tagId);
  const busy = enqueueingTagIds.has(tagId);
  return (
    <div>
      {clip && <StatusBadge status={clip.status} />}
      {canEnqueueClip(clip) && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void enqueue(tagId).catch(() => {})}
        >
          {clip?.status === "failed" ? "Erneut schneiden" : "Clip schneiden"}
        </button>
      )}
    </div>
  );
}

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
      return { ok: true, status: 200, json: async () => body ?? {} };
    }) as unknown as typeof fetch,
  );
}

function renderProbe(): void {
  render(
    <ClipBoardProvider gameId={gameId}>
      <ClipProbe />
    </ClipBoardProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ClipBoardProvider", () => {
  beforeEach(() => {
    mockFetch({ get: () => ({ clips: [] }) });
  });

  it("offers a cut control for a tag that has no clip yet", async () => {
    renderProbe();
    await waitFor(() =>
      expect(screen.getByText("Clip schneiden")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Bereit")).not.toBeInTheDocument();
  });

  it("enqueues a cut for the tag and shows its returned status", async () => {
    mockFetch({
      get: () => ({ clips: [] }),
      post: () => ({ clip: { id: "clip-1", tagId, status: "pending" } }),
    });
    renderProbe();

    fireEvent.click(await screen.findByText("Clip schneiden"));

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
    renderProbe();

    await waitFor(() =>
      expect(screen.getByText("Fehlgeschlagen")).toBeInTheDocument(),
    );
    expect(screen.getByText("Erneut schneiden")).toBeInTheDocument();
  });
});
