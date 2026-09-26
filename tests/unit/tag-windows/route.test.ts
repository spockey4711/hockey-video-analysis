import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectGoldenPayload } from "../app-api/golden";

const mocks = vi.hoisted(() => ({
  getApiSession: vi.fn(),
  getTagWindows: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getApiSession: mocks.getApiSession }));
vi.mock("@/features/tag-windows/queries", () => ({
  getTagWindows: mocks.getTagWindows,
}));

import { GET } from "@/app/api/tag-windows/route";
import { DEFAULT_TAG_WINDOWS, resolveTagWindows } from "@/lib/tag-types";

// The Mac reads the windows with its device token (Mac plan S3).
function request() {
  return new Request("http://localhost/api/tag-windows", {
    headers: { authorization: `Bearer ${"f".repeat(64)}` },
  });
}

beforeEach(() => {
  mocks.getApiSession.mockResolvedValue({
    publicId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    kind: "device",
    coach: { id: "coach-1", email: "coach@example.test", name: "Coach" },
  });
  mocks.getTagWindows.mockResolvedValue(
    resolveTagWindows([{ type: "goal", preS: 15, postS: 5 }]),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/tag-windows", () => {
  it("returns every type's effective window to a coach, uncached", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body: unknown = await response.json();
    await expectGoldenPayload("tag-windows", body);
    expect(body).toEqual({
      windows: [
        { type: "goal", preS: 15, postS: 5, isDefault: false },
        {
          type: "corner_short",
          ...DEFAULT_TAG_WINDOWS.corner_short,
          isDefault: true,
        },
        {
          type: "action_good",
          ...DEFAULT_TAG_WINDOWS.action_good,
          isDefault: true,
        },
        {
          type: "action_bad",
          ...DEFAULT_TAG_WINDOWS.action_bad,
          isDefault: true,
        },
      ],
    });
  });

  it("refuses a request without a coach session before any query", async () => {
    mocks.getApiSession.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.getTagWindows).not.toHaveBeenCalled();
  });
});
