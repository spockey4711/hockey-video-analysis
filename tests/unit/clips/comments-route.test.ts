import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCoach, addCommentToClip, canShareTokenReachClip } =
  vi.hoisted(() => ({
    getCurrentCoach: vi.fn(),
    addCommentToClip: vi.fn(),
    canShareTokenReachClip: vi.fn(),
  }));

vi.mock("@/features/access", () => ({ getCurrentCoach }));
vi.mock("@/features/clips/comments", async () => ({
  ...(await import("@/features/clips/comments/validation")),
  addCommentToClip,
  canShareTokenReachClip,
  clipExists: vi.fn(),
  listCommentsForClip: vi.fn(),
}));

import { POST } from "@/app/api/clips/[id]/comments/route";

const clipId = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";

function post(body: unknown, shareToken?: string): Request {
  const query = shareToken ? `?shareToken=${shareToken}` : "";
  return new Request(`http://localhost/api/clips/${clipId}/comments${query}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: clipId }) };

beforeEach(() => {
  getCurrentCoach.mockResolvedValue(null);
  canShareTokenReachClip.mockResolvedValue(true);
  addCommentToClip.mockImplementation(
    async (_clip: string, input: object, writer: object) => ({
      ...input,
      ...writer,
    }),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/clips/[id]/comments coach marking", () => {
  it("stores a comment from a coach session as a coach comment", async () => {
    getCurrentCoach.mockResolvedValue({ id: "coach-1" });

    const response = await POST(
      post({ author: "Trainerin", body: "Abstand halten." }),
      context,
    );

    expect(response.status).toBe(201);
    expect(addCommentToClip).toHaveBeenCalledWith(
      clipId,
      { author: "Trainerin", body: "Abstand halten." },
      { isCoach: true },
    );
  });

  it("never lets a share-link viewer create a coach comment, even by asking", async () => {
    const response = await POST(
      post(
        { author: "Trainerin", body: "Ich bin der Trainer.", isCoach: true },
        "tok",
      ),
      context,
    );

    expect(response.status).toBe(201);
    expect(addCommentToClip).toHaveBeenCalledWith(
      clipId,
      { author: "Trainerin", body: "Ich bin der Trainer." },
      { isCoach: false },
    );
  });

  it("rejects a share token that does not reach the clip without writing", async () => {
    canShareTokenReachClip.mockResolvedValue(false);

    const response = await POST(
      post({ author: "Alex", body: "Hallo.", isCoach: true }, "wrong"),
      context,
    );

    expect(response.status).toBe(401);
    expect(addCommentToClip).not.toHaveBeenCalled();
  });
});
