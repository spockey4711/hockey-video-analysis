import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCoach, recordViewEvent } = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  recordViewEvent: vi.fn(),
}));

vi.mock("@/features/access", () => ({ getCurrentCoach }));
vi.mock("@/features/share/views", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/share/views")>()),
  recordViewEvent,
}));

import { POST } from "@/app/api/collection-views/route";

const clipId = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";
const event = { token: "tok", clipId, type: "full_view" };

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/collection-views", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

beforeEach(() => {
  getCurrentCoach.mockResolvedValue(null);
  recordViewEvent.mockResolvedValue("recorded");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/collection-views", () => {
  it("records a valid event with only the viewer's IP and user agent", async () => {
    const response = await POST(
      post(JSON.stringify(event), {
        "x-real-ip": "203.0.113.7",
        "user-agent": "Mozilla/5.0 (Test)",
      }),
    );

    expect(response.status).toBe(204);
    expect(recordViewEvent).toHaveBeenCalledWith(event, {
      ip: "203.0.113.7",
      userAgent: "Mozilla/5.0 (Test)",
    });
  });

  it("answers 204 for events dropped by the bounds", async () => {
    for (const outcome of ["duplicate", "limited"]) {
      recordViewEvent.mockResolvedValueOnce(outcome);
      expect((await POST(post(JSON.stringify(event)))).status).toBe(204);
    }
  });

  it("answers 404 when the token and clip do not belong together", async () => {
    recordViewEvent.mockResolvedValue("not-found");
    const response = await POST(post(JSON.stringify(event)));
    expect(response.status).toBe(404);
  });

  it("ignores an unknown event type without touching the database", async () => {
    const response = await POST(
      post(JSON.stringify({ ...event, type: "share" })),
    );
    expect(response.status).toBe(204);
    expect(recordViewEvent).not.toHaveBeenCalled();
  });

  it("does not count a signed-in coach's preview", async () => {
    getCurrentCoach.mockResolvedValue({ id: "coach" });
    const response = await POST(post(JSON.stringify(event)));
    expect(response.status).toBe(204);
    expect(recordViewEvent).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and invalid fields", async () => {
    expect((await POST(post("{"))).status).toBe(400);
    expect(
      (await POST(post(JSON.stringify({ ...event, clipId: "x" })))).status,
    ).toBe(400);
    expect(recordViewEvent).not.toHaveBeenCalled();
  });

  it("rejects an oversized body", async () => {
    const big = JSON.stringify({ ...event, padding: "x".repeat(2_000) });
    expect((await POST(post(big))).status).toBe(413);
    expect(recordViewEvent).not.toHaveBeenCalled();
  });

  it("answers 500 without details when recording fails", async () => {
    recordViewEvent.mockRejectedValue(new Error("db down"));
    const response = await POST(post(JSON.stringify(event)));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "unexpected error" });
  });
});
