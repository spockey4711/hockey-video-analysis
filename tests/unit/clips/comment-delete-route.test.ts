import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCoach, deleteCommentFromClip, canShareTokenReachClip } =
  vi.hoisted(() => ({
    getCurrentCoach: vi.fn(),
    deleteCommentFromClip: vi.fn(),
    canShareTokenReachClip: vi.fn(),
  }));

vi.mock("@/features/access", () => ({ getCurrentCoach }));
vi.mock("@/features/clips/comments", () => ({
  deleteCommentFromClip,
  canShareTokenReachClip,
}));

import { DELETE } from "@/app/api/clips/[id]/comments/[commentId]/route";

const clipId = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";
const commentId = "0d9e8f7a-6b5c-4d3e-8f21-0a1b2c3d4e5f";

function del(shareToken?: string): Request {
  const query = shareToken ? `?shareToken=${shareToken}` : "";
  return new Request(
    `http://localhost/api/clips/${clipId}/comments/${commentId}${query}`,
    { method: "DELETE" },
  );
}

function context(ids: { id?: string; commentId?: string } = {}) {
  return { params: Promise.resolve({ id: clipId, commentId, ...ids }) };
}

beforeEach(() => {
  getCurrentCoach.mockResolvedValue(null);
  // A share token that reaches the clip - so a refusal below is the route's
  // own rule, not a token that simply cannot see the clip.
  canShareTokenReachClip.mockResolvedValue(true);
  deleteCommentFromClip.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/clips/[id]/comments/[commentId] authorization", () => {
  it("lets a signed-in coach delete a comment", async () => {
    getCurrentCoach.mockResolvedValue({ id: "coach-1" });

    const response = await DELETE(del(), context());

    expect(response.status).toBe(204);
    expect(deleteCommentFromClip).toHaveBeenCalledWith(clipId, commentId);
  });

  it("refuses a share-link viewer, even with a token that reaches the clip", async () => {
    const response = await DELETE(del("team-token"), context());

    expect(response.status).toBe(401);
    expect(deleteCommentFromClip).not.toHaveBeenCalled();
  });

  it("refuses a request with neither a session nor a token", async () => {
    const response = await DELETE(del(), context());

    expect(response.status).toBe(401);
    expect(deleteCommentFromClip).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/clips/[id]/comments/[commentId] validation", () => {
  beforeEach(() => {
    getCurrentCoach.mockResolvedValue({ id: "coach-1" });
  });

  it("rejects an id that is not a uuid before touching the database", async () => {
    const badClip = await DELETE(del(), context({ id: "nope" }));
    const badComment = await DELETE(del(), context({ commentId: "1; drop" }));

    expect(badClip.status).toBe(400);
    expect(badComment.status).toBe(400);
    expect(deleteCommentFromClip).not.toHaveBeenCalled();
  });

  it("answers 404 when no comment with that id is on that clip", async () => {
    deleteCommentFromClip.mockResolvedValue(false);

    const response = await DELETE(del(), context());

    expect(response.status).toBe(404);
  });
});
