import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectGoldenPayload, expectNoSecrets } from "./golden";

// The routes run end to end over the real queries against a stand-in for the
// drizzle chains: every step returns the chain, and awaiting it yields the
// next queued rows. The rows carry share tokens and a session token hash on
// purpose, as a careless `select *` would, so the tests prove the payloads are
// built from explicit fields. Each response is pinned as a golden payload in
// `contracts/api/` for the Swift client's decoding tests.
const db = vi.hoisted(() => {
  const results: unknown[][] = [];
  const selected: Record<string, unknown>[] = [];
  const chain = (fields?: Record<string, unknown>) => {
    if (fields) selected.push(fields);
    const step: Record<string, unknown> = {};
    for (const method of ["from", "where", "orderBy", "limit"]) {
      step[method] = () => step;
    }
    step.then = (
      resolve: (rows: unknown[]) => unknown,
      reject: (cause: unknown) => unknown,
    ) => Promise.resolve(results.shift() ?? []).then(resolve, reject);
    return step;
  };
  const client = {
    select: vi.fn(chain),
    transaction: vi.fn(
      async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
        run(client),
    ),
  };
  return { results, selected, client };
});
const auth = vi.hoisted(() => ({ getApiSession: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: db.client }));
vi.mock("@/lib/auth", () => auth);

import { GET as getGame } from "@/app/api/app/v1/games/[id]/route";
import { GET as getLibrary } from "@/app/api/app/v1/library/route";
import { GET as getPlayers } from "@/app/api/app/v1/players/route";
import { MIN_APP_VERSION } from "@/features/app-api/version";

const GAME = "5d9c1f0e-2b7a-4c3d-9e8f-0a1b2c3d4e5f";
const CHAPTER_1 = "8a1f2e3d-4c5b-4a69-8778-695a4b3c2d1e";
const CHAPTER_2 = "9b2e3f4a-5d6c-4b7a-8988-7a6b5c4d3e2f";
const TAG_GOAL = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const TAG_CORNER = "2d3e4f5a-6b7c-4d8e-9fa0-1b2c3d4e5f6a";
const CLIP_OLD = "3e4f5a6b-7c8d-4e9f-a0b1-2c3d4e5f6a7b";
const CLIP_NEW = "4f5a6b7c-8d9e-4fa0-b1c2-3d4e5f6a7b8c";
const PLAYER_A = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const PLAYER_B = "7b8c9d0e-1f2a-4b3c-9d4e-5f6a7b8c9d0e";
const COACH = "0f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0f";
const COLLECTION = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const SCENE = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

// Planted secrets: none of these may appear in any payload.
const PLAYER_TOKEN = "player-share-token-0123456789abcdef";
const COLLECTION_TOKEN = "collection-share-token-0123456789ab";
const TEAM_TOKEN = "team-share-token-0123456789abcdef";
const SESSION_HASH = "e".repeat(64);
const SECRETS = [PLAYER_TOKEN, COLLECTION_TOKEN, TEAM_TOKEN, SESSION_HASH];

function request(path: string, version: string | null = MIN_APP_VERSION) {
  const headers = new Headers({ authorization: `Bearer ${"f".repeat(64)}` });
  if (version !== null) headers.set("X-HVA-App-Version", version);
  return new Request(`http://localhost${path}`, { headers });
}

function gameContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function queueGameSnapshot() {
  db.results.push(
    [
      {
        id: GAME,
        title: "Heimspiel",
        opponent: "TSV Beispiel",
        playedOn: "2026-09-20",
        periodCount: null,
        periodLengthS: null,
        version: 3,
        revision: 42,
        quartersVersion: 5,
        createdBy: COACH,
      },
    ],
    [
      {
        id: CHAPTER_1,
        orderIndex: 0,
        filePath: "2026-09-20 Heimspiel/GX010001.MP4",
        durationS: 1062.495,
        frameRate: 59.94,
      },
      {
        id: CHAPTER_2,
        orderIndex: 1,
        filePath: "2026-09-20 Heimspiel/GX020001.MP4",
        durationS: 812.08,
        frameRate: null,
      },
    ],
    [
      { index: 1, startS: 12.5, endS: 912.5 },
      { index: 2, startS: 1030, endS: null },
    ],
    [
      {
        id: TAG_GOAL,
        type: "goal",
        startS: 990,
        endS: 1005,
        visibility: "single",
        source: "manual",
        authorId: COACH,
        version: 4,
        createdAt: new Date("2026-09-20T15:04:05.000Z"),
      },
      {
        id: TAG_CORNER,
        type: "corner_short",
        startS: 1100.25,
        endS: null,
        visibility: "team",
        source: "suggestion",
        authorId: null,
        version: 1,
        createdAt: new Date("2026-09-20T15:10:00.000Z"),
      },
    ],
    [
      { tagId: TAG_GOAL, playerId: PLAYER_A, shareToken: PLAYER_TOKEN },
      { tagId: TAG_GOAL, playerId: PLAYER_B, shareToken: PLAYER_TOKEN },
    ],
    [
      {
        id: CLIP_NEW,
        tagId: TAG_GOAL,
        status: "ready",
        cutStartS: 989.2,
        outputPath: "clips/clip.mp4",
      },
      { id: CLIP_OLD, tagId: TAG_GOAL, status: "failed", cutStartS: null },
    ],
  );
}

beforeEach(() => {
  db.results.length = 0;
  db.selected.length = 0;
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  auth.getApiSession.mockResolvedValue({
    publicId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    kind: "device",
    coach: { id: COACH, email: "coach@example.test", name: "Coach" },
  });
});

/** No query may select a share token or a session column. */
function expectNoSecretColumns() {
  for (const fields of db.selected) {
    expect(Object.keys(fields)).not.toContain("shareToken");
    expect(Object.keys(fields)).not.toContain("teamShareToken");
  }
}

describe("GET /api/app/v1/library", () => {
  it("lists every game, collection and scene with its revision", async () => {
    db.results.push(
      [
        {
          id: GAME,
          title: "Heimspiel",
          opponent: "TSV Beispiel",
          playedOn: "2026-09-20",
          revision: 42,
        },
        {
          id: CHAPTER_1,
          title: "",
          opponent: null,
          playedOn: null,
          revision: 1,
        },
      ],
      [
        {
          id: COLLECTION,
          name: "Ecken Woche 3",
          revision: 7,
          shareToken: COLLECTION_TOKEN,
        },
      ],
      [{ id: SCENE, name: "Pressing links", revision: 2 }],
      [{ rosterRevision: 9, teamShareToken: TEAM_TOKEN }],
    );

    const response = await getLibrary(request("/api/app/v1/library"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body: unknown = await response.json();
    expect(body).toEqual({
      games: [
        {
          id: GAME,
          title: "Heimspiel",
          opponent: "TSV Beispiel",
          playedOn: "2026-09-20",
          revision: 42,
        },
        {
          id: CHAPTER_1,
          title: "",
          opponent: null,
          playedOn: null,
          revision: 1,
        },
      ],
      collections: [{ id: COLLECTION, name: "Ecken Woche 3", revision: 7 }],
      scenes: [{ id: SCENE, name: "Pressing links", revision: 2 }],
      rosterRevision: 9,
    });
    expectNoSecrets(body, SECRETS);
    expectNoSecretColumns();
    await expectGoldenPayload("library", body);
  });

  it("reads everything in one read-only repeatable-read transaction", async () => {
    await getLibrary(request("/api/app/v1/library"));
    expect(db.client.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
  });
});

describe("GET /api/app/v1/games/{id}", () => {
  it("returns the game with chapters, quarters and tags", async () => {
    queueGameSnapshot();

    const response = await getGame(
      request(`/api/app/v1/games/${GAME}`),
      gameContext(GAME),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as {
      game: Record<string, unknown>;
      tags: { playerIds: string[]; clip: unknown }[];
    };
    expect(body.game).toEqual({
      id: GAME,
      title: "Heimspiel",
      opponent: "TSV Beispiel",
      playedOn: "2026-09-20",
      periodCount: null,
      periodLengthS: null,
      version: 3,
      revision: 42,
      quartersVersion: 5,
    });
    // The newest clip is the tag's current one; a tag without one has null.
    expect(body.tags[0].clip).toEqual({
      id: CLIP_NEW,
      status: "ready",
      cutStartS: 989.2,
    });
    expect(body.tags[0].playerIds).toEqual([PLAYER_A, PLAYER_B]);
    expect(body.tags[1]).toMatchObject({ playerIds: [], clip: null });
    expect(JSON.stringify(body)).not.toContain("clips/clip.mp4");
    expectNoSecrets(body, SECRETS);
    expectNoSecretColumns();
    await expectGoldenPayload("game", body);
  });

  it("answers 404 for a game that does not exist or is still hidden", async () => {
    db.results.push([]);
    const response = await getGame(
      request(`/api/app/v1/games/${GAME}`),
      gameContext(GAME),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "game not found",
    });
  });

  it("refuses a malformed id before reading anything", async () => {
    const response = await getGame(
      request("/api/app/v1/games/not-a-game"),
      gameContext("not-a-game"),
    );
    expect(response.status).toBe(400);
    expect(db.client.select).not.toHaveBeenCalled();
  });
});

describe("GET /api/app/v1/players", () => {
  it("returns the roster with versions and never a share token", async () => {
    db.results.push(
      [
        {
          id: PLAYER_A,
          name: "Spielerin A",
          jerseyNumber: 7,
          version: 2,
          shareToken: PLAYER_TOKEN,
        },
        {
          id: PLAYER_B,
          name: "Spielerin B",
          jerseyNumber: null,
          version: 1,
          shareToken: PLAYER_TOKEN,
        },
      ],
      [{ rosterRevision: 9, teamShareToken: TEAM_TOKEN }],
    );

    const response = await getPlayers(request("/api/app/v1/players"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body: unknown = await response.json();
    expect(body).toEqual({
      rosterRevision: 9,
      players: [
        { id: PLAYER_A, name: "Spielerin A", jerseyNumber: 7, version: 2 },
        { id: PLAYER_B, name: "Spielerin B", jerseyNumber: null, version: 1 },
      ],
    });
    expectNoSecrets(body, SECRETS);
    expectNoSecretColumns();
    await expectGoldenPayload("players", body);
  });
});

describe.each([
  ["library", () => getLibrary(request("/api/app/v1/library"))],
  ["players", () => getPlayers(request("/api/app/v1/players"))],
  [
    "game",
    () => getGame(request(`/api/app/v1/games/${GAME}`), gameContext(GAME)),
  ],
])("the %s pull's gates", (_name, call) => {
  it("answers 401 without a valid session and reads nothing", async () => {
    auth.getApiSession.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(401);
    expect(db.client.select).not.toHaveBeenCalled();
  });

  it("answers 500 without details when the database fails", async () => {
    db.client.transaction.mockRejectedValueOnce(new Error("connection lost"));
    const response = await call();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "unexpected error",
    });
  });
});

describe("the version gate", () => {
  it("answers 400 without the app version header, before the session", async () => {
    const response = await getLibrary(request("/api/app/v1/library", null));
    expect(response.status).toBe(400);
    expect(auth.getApiSession).not.toHaveBeenCalled();
  });

  it("answers 426 to a build older than the API supports", async () => {
    const response = await getPlayers(request("/api/app/v1/players", "0.0.1"));
    expect(response.status).toBe(426);
  });
});
