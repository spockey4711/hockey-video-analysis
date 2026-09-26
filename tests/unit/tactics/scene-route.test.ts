import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  getScene: vi.fn(),
  listBoardRoster: vi.fn(),
}));

vi.mock("@/features/access", () => ({
  getCurrentCoach: mocks.getCurrentCoach,
}));
vi.mock("@/features/tactics/queries", () => ({
  getScene: mocks.getScene,
  listBoardRoster: mocks.listBoardRoster,
}));

import { GET } from "@/app/api/tactics/scenes/[id]/route";
import { defaultScene } from "@/features/tactics/scene";

const SCENE_ID = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";
const stored = { id: SCENE_ID, name: "Ecke kurz", scene: defaultScene() };

// Made-up players: two linked from the scene below, one not.
const LINKED_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const ROSTER = [
  { id: LINKED_ID, name: "Mila Beispiel", jerseyNumber: 7 },
  { id: OTHER_ID, name: "Nora Muster", jerseyNumber: 9 },
];

function get(id = SCENE_ID) {
  return GET(new Request(`http://localhost/api/tactics/scenes/${id}`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  mocks.getCurrentCoach.mockResolvedValue({ id: "coach-1" });
  mocks.getScene.mockResolvedValue(stored);
  mocks.listBoardRoster.mockResolvedValue(ROSTER);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/tactics/scenes/[id]", () => {
  it("returns the scene to a coach", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...stored, roster: [] });
    expect(mocks.getScene).toHaveBeenCalledWith(SCENE_ID);
    // A scene without roster links needs no roster at all.
    expect(mocks.listBoardRoster).not.toHaveBeenCalled();
  });

  it("names only the roster players the scene's tokens link to", async () => {
    const scene = defaultScene();
    mocks.getScene.mockResolvedValue({
      ...stored,
      scene: {
        ...scene,
        tokens: scene.tokens.map((token) =>
          token.id === "p1" && token.kind === "player"
            ? { ...token, playerId: LINKED_ID }
            : token,
        ),
      },
    });
    const body = await (await get()).json();
    expect(body.roster).toEqual([ROSTER[0]]);
    expect(JSON.stringify(body)).not.toContain("Nora");
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
