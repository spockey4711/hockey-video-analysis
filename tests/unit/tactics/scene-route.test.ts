import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  getScene: vi.fn(),
}));

vi.mock("@/features/access", () => ({
  getCurrentCoach: mocks.getCurrentCoach,
}));
vi.mock("@/features/tactics/queries", () => ({
  getScene: mocks.getScene,
}));

import { GET } from "@/app/api/tactics/scenes/[id]/route";
import { defaultScene } from "@/features/tactics/scene";

const SCENE_ID = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";
const stored = { id: SCENE_ID, name: "Ecke kurz", scene: defaultScene() };

function get(id = SCENE_ID) {
  return GET(new Request(`http://localhost/api/tactics/scenes/${id}`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  mocks.getCurrentCoach.mockResolvedValue({ id: "coach-1" });
  mocks.getScene.mockResolvedValue(stored);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/tactics/scenes/[id]", () => {
  it("returns the scene to a coach", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(stored);
    expect(mocks.getScene).toHaveBeenCalledWith(SCENE_ID);
  });

  it("refuses a request without a coach session before any query", async () => {
    mocks.getCurrentCoach.mockResolvedValue(null);
    const response = await get();
    expect(response.status).toBe(401);
    expect(mocks.getScene).not.toHaveBeenCalled();
  });

  it("rejects a malformed id before any query", async () => {
    const response = await get("not-a-uuid");
    expect(response.status).toBe(400);
    expect(mocks.getScene).not.toHaveBeenCalled();
  });

  it("is a 404 for an unknown scene or one that no longer parses", async () => {
    mocks.getScene.mockResolvedValue(null);
    const response = await get();
    expect(response.status).toBe(404);
  });
});
