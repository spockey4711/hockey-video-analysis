import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentThread } from "@/features/clips/comments/CommentThread";
import type { CommentView } from "@/features/clips/comments/client";
import { commentsContent } from "@/features/clips/comments/content";

const clipA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const clipB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const existing: CommentView[] = [
  {
    id: "c1",
    author: "Ada",
    body: "Starker Pass.",
    createdAt: "2026-09-22T10:00:00Z",
  },
];

/**
 * Mock `fetch`: GET returns the comments for the clip in the URL, POST echoes
 * the submitted body back as a persisted comment. `failPost` forces the given
 * status on POST so the error paths can be exercised.
 */
function stubFetch(
  byClip: Record<string, CommentView[]>,
  options: { failGet?: boolean; failPost?: number } = {},
) {
  let nextId = 100;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      if (options.failPost) {
        return { ok: false, status: options.failPost, json: async () => ({}) };
      }
      const input = JSON.parse(init.body as string) as {
        author: string;
        body: string;
      };
      const comment: CommentView = {
        id: `c${nextId++}`,
        ...input,
        createdAt: "2026-09-22T11:00:00Z",
      };
      return { ok: true, status: 201, json: async () => ({ comment }) };
    }
    if (options.failGet) {
      return { ok: false, status: 401, json: async () => ({}) };
    }
    const clipId = url.split("/")[3];
    return {
      ok: true,
      status: 200,
      json: async () => ({ comments: byClip[clipId] ?? [] }),
    };
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CommentThread", () => {
  it("loads and lists the clip's comments with a count", async () => {
    const fetchMock = stubFetch({ [clipA]: existing });
    render(<CommentThread clipId={clipA} shareToken="tok" />);

    expect(screen.getByText(commentsContent.loading)).toBeInTheDocument();
    expect(await screen.findByText("Starker Pass.")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Kommentare \(1\)/ }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/clips/${clipA}/comments?shareToken=tok`,
    );
  });

  it("shows the empty hint when the clip has no comments", async () => {
    stubFetch({});
    render(<CommentThread clipId={clipA} />);
    expect(await screen.findByText(commentsContent.empty)).toBeInTheDocument();
  });

  it("shows a load error when the request fails", async () => {
    stubFetch({}, { failGet: true });
    render(<CommentThread clipId={clipA} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      commentsContent.errors.load,
    );
  });

  it("disables submit until both name and body are filled", async () => {
    stubFetch({});
    render(<CommentThread clipId={clipA} />);
    await screen.findByText(commentsContent.empty);

    const submit = screen.getByRole("button", {
      name: commentsContent.form.submit,
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(commentsContent.form.authorLabel), {
      target: { value: "Ben" },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(commentsContent.form.bodyLabel), {
      target: { value: "   " },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(commentsContent.form.bodyLabel), {
      target: { value: "Gut gesehen." },
    });
    expect(submit).toBeEnabled();
  });

  it("posts a comment, appends it and clears the body", async () => {
    const fetchMock = stubFetch({ [clipA]: existing });
    render(<CommentThread clipId={clipA} shareToken="tok" />);
    await screen.findByText("Starker Pass.");

    fireEvent.change(screen.getByLabelText(commentsContent.form.authorLabel), {
      target: { value: "  Ben " },
    });
    const body = screen.getByLabelText(commentsContent.form.bodyLabel);
    fireEvent.change(body, { target: { value: " Gut gesehen. " } });
    fireEvent.click(
      screen.getByRole("button", { name: commentsContent.form.submit }),
    );

    expect(await screen.findByText("Gut gesehen.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Kommentare \(2\)/ }),
    ).toBeInTheDocument();
    expect(body).toHaveValue("");
    // The name stays for the next comment; the posted fields were trimmed.
    expect(screen.getByLabelText(commentsContent.form.authorLabel)).toHaveValue(
      "  Ben ",
    );
    const post = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "POST",
    )!;
    expect(post[0]).toBe(`/api/clips/${clipA}/comments?shareToken=tok`);
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({
      author: "Ben",
      body: "Gut gesehen.",
    });
  });

  it("reports a rejected comment and keeps the draft", async () => {
    stubFetch({}, { failPost: 500 });
    render(<CommentThread clipId={clipA} />);
    await screen.findByText(commentsContent.empty);

    fireEvent.change(screen.getByLabelText(commentsContent.form.authorLabel), {
      target: { value: "Ben" },
    });
    fireEvent.change(screen.getByLabelText(commentsContent.form.bodyLabel), {
      target: { value: "Gut gesehen." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: commentsContent.form.submit }),
    );

    await waitFor(() =>
      expect(screen.getByText(commentsContent.errors.submit)).toBeVisible(),
    );
    expect(screen.getByLabelText(commentsContent.form.bodyLabel)).toHaveValue(
      "Gut gesehen.",
    );
  });

  it("reloads for a new clip and keeps the typed name", async () => {
    const fetchMock = stubFetch({
      [clipA]: existing,
      [clipB]: [
        {
          id: "c2",
          author: "Cem",
          body: "Zweiter Clip.",
          createdAt: "2026-09-22T10:30:00Z",
        },
      ],
    });
    const { rerender } = render(
      <CommentThread clipId={clipA} shareToken="tok" />,
    );
    await screen.findByText("Starker Pass.");
    fireEvent.change(screen.getByLabelText(commentsContent.form.authorLabel), {
      target: { value: "Ben" },
    });
    fireEvent.change(screen.getByLabelText(commentsContent.form.bodyLabel), {
      target: { value: "Entwurf" },
    });

    rerender(<CommentThread clipId={clipB} shareToken="tok" />);

    expect(await screen.findByText("Zweiter Clip.")).toBeInTheDocument();
    expect(screen.queryByText("Starker Pass.")).not.toBeInTheDocument();
    expect(screen.getByLabelText(commentsContent.form.authorLabel)).toHaveValue(
      "Ben",
    );
    // A draft belongs to the clip it was written on, so it does not carry over.
    expect(screen.getByLabelText(commentsContent.form.bodyLabel)).toHaveValue(
      "",
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/clips/${clipB}/comments?shareToken=tok`,
    );
  });

  it("can hide its own heading for hosts that label the thread", async () => {
    stubFetch({});
    render(<CommentThread clipId={clipA} showHeading={false} />);
    await screen.findByText(commentsContent.empty);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
