import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentThread } from "@/features/clips/comments/CommentThread";
import type { CommentView } from "@/features/clips/comments/client";
import { commentsContent } from "@/features/clips/comments/content";

const clipId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const comments: CommentView[] = [
  {
    id: "c1",
    author: "Ada",
    body: "Starker Pass.",
    isCoach: false,
    createdAt: "2026-09-22T10:00:00Z",
  },
  {
    id: "c2",
    author: "Ben",
    body: "Das war nichts.",
    isCoach: false,
    createdAt: "2026-09-22T10:05:00Z",
  },
];

/** GET lists {@link comments}; DELETE answers `deleteStatus`. */
function stubFetch(deleteStatus = 204) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") {
      return {
        ok: deleteStatus >= 200 && deleteStatus < 300,
        status: deleteStatus,
        json: async () => ({}),
      };
    }
    return { ok: true, status: 200, json: async () => ({ comments }) };
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

const trash = (author: string) =>
  screen.getByRole("button", { name: commentsContent.delete.label(author) });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CommentThread delete (coach)", () => {
  it("deletes a comment only after the confirm step", async () => {
    const fetchMock = stubFetch();
    render(<CommentThread clipId={clipId} canDelete />);
    await screen.findByText("Das war nichts.");

    fireEvent.click(trash("Ben"));
    const confirm = screen.getByRole("group", {
      name: commentsContent.delete.label("Ben"),
    });
    expect(confirm).toHaveTextContent(commentsContent.delete.confirm);
    // The safe choice takes focus, so a second Enter never deletes.
    expect(
      within(confirm).getByRole("button", {
        name: commentsContent.delete.cancel,
      }),
    ).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(
      within(confirm).getByRole("button", {
        name: commentsContent.delete.confirmYes,
      }),
    );

    await waitFor(() =>
      expect(screen.queryByText("Das war nichts.")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Starker Pass.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Kommentare \(1\)/ }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/clips/${clipId}/comments/c2`,
      { method: "DELETE" },
    );
  });

  it("keeps the comment and returns focus to the bin when cancelled", async () => {
    const fetchMock = stubFetch();
    render(<CommentThread clipId={clipId} canDelete />);
    await screen.findByText("Das war nichts.");

    fireEvent.click(trash("Ben"));
    fireEvent.click(
      screen.getByRole("button", { name: commentsContent.delete.cancel }),
    );

    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByText("Das war nichts.")).toBeInTheDocument();
    expect(trash("Ben")).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the comment and says so when the delete fails", async () => {
    stubFetch(500);
    render(<CommentThread clipId={clipId} canDelete />);
    await screen.findByText("Das war nichts.");

    fireEvent.click(trash("Ben"));
    fireEvent.click(
      screen.getByRole("button", { name: commentsContent.delete.confirmYes }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      commentsContent.delete.error,
    );
    expect(screen.getByText("Das war nichts.")).toBeInTheDocument();
  });

  it("offers no delete on a share link", async () => {
    stubFetch();
    render(<CommentThread clipId={clipId} shareToken="tok" />);
    await screen.findByText("Das war nichts.");

    expect(
      screen.queryByRole("button", { name: /löschen/ }),
    ).not.toBeInTheDocument();
  });
});
