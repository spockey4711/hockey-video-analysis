import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  getTagWindows: vi.fn(),
}));

vi.mock("@/features/access", () => ({
  getCurrentCoach: mocks.getCurrentCoach,
}));
vi.mock("@/features/tag-windows/queries", () => ({
  getTagWindows: mocks.getTagWindows,
}));

import { GET } from "@/app/api/tag-windows/route";
import { DEFAULT_TAG_WINDOWS, resolveTagWindows } from "@/lib/tag-types";

beforeEach(() => {
  mocks.getCurrentCoach.mockResolvedValue({ id: "coach-1" });
  mocks.getTagWindows.mockResolvedValue(
    resolveTagWindows([{ type: "goal", preS: 15, postS: 5 }]),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/tag-windows", () => {
  it("returns every type's effective window to a coach, uncached", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
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
    mocks.getCurrentCoach.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.getTagWindows).not.toHaveBeenCalled();
  });
});
