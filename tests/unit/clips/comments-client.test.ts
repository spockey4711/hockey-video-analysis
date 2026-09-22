import { afterEach, describe, expect, it, vi } from "vitest";

import {
  commentsEndpoint,
  fetchComments,
  postComment,
} from "@/features/clips/comments/client";

const clipId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("commentsEndpoint", () => {
  it("omits the query when no share token is held (coach)", () => {
    expect(commentsEndpoint(clipId)).toBe(`/api/clips/${clipId}/comments`);
  });

  it("passes the share token as a query parameter, URL-encoded", () => {
    expect(commentsEndpoint(clipId, "a b&c")).toBe(
      `/api/clips/${clipId}/comments?shareToken=a%20b%26c`,
    );
  });
});

describe("fetchComments", () => {
  it("returns the comments array from the response", async () => {
    const comments = [
      { id: "1", author: "Ada", body: "hi", createdAt: "2026-09-22T10:00:00Z" },
    ];
    const fetchMock = stubFetch(200, { comments });
    await expect(fetchComments(clipId, "tok")).resolves.toEqual(comments);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/clips/${clipId}/comments?shareToken=tok`,
    );
  });

  it("throws on a non-2xx response", async () => {
    stubFetch(401, { error: "unauthorized" });
    await expect(fetchComments(clipId, "tok")).rejects.toThrow(/401/);
  });
});

describe("postComment", () => {
  const input = { author: "Ada", body: "Nice run." };

  it("posts the JSON body and returns the persisted comment", async () => {
    const comment = { id: "1", ...input, createdAt: "2026-09-22T10:00:00Z" };
    const fetchMock = stubFetch(201, { comment });

    await expect(postComment(clipId, input)).resolves.toEqual({
      ok: true,
      comment,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`/api/clips/${clipId}/comments`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it("reports a 400 as invalid input", async () => {
    stubFetch(400, { error: "author must not be empty" });
    await expect(postComment(clipId, input)).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("reports any other failure as failed", async () => {
    stubFetch(500, { error: "unexpected error" });
    await expect(postComment(clipId, input)).resolves.toEqual({
      ok: false,
      reason: "failed",
    });
  });
});
