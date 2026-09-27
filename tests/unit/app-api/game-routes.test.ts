import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectGoldenPayload } from "./golden";

// The Mac game routes (ADR 0013, Mac plan S4) against mocked queries: what
// matters is the version gate, the bearer session, that bad bodies and paths
// never reach a query, and the status codes and bodies the Mac relies on. The
// bodies are pinned as golden payloads in `contracts/api/`. The queries
// themselves are covered in `game-writes.test.ts`.
const auth = vi.hoisted(() => ({ getApiSession: vi.fn() }));
const writes = vi.hoisted(() => ({
  registerMacGame: vi.fn(),
  updateGameFields: vi.fn(),
}));
const reads = vi.hoisted(() => ({
  getGameSnapshot: vi.fn(),
  getGameFields: vi.fn(),
}));
const review = vi.hoisted(() => ({
  acceptImportedGame: vi.fn(),
  discardImportedGame: vi.fn(),
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/features/app-api/games", () => writes);
vi.mock("@/features/app-api/queries", () => reads);
vi.mock("@/features/games/queries", () => review);

import { POST as acceptGame } from "@/app/api/app/v1/games/[id]/accept/route";
import { POST as discardGame } from "@/app/api/app/v1/games/[id]/discard/route";
import { PATCH as patchGame } from "@/app/api/app/v1/games/[id]/route";
import { POST as registerGame } from "@/app/api/app/v1/games/route";
import { MIN_APP_VERSION } from "@/features/app-api/version";

const GAME = "5d9c1f0e-2b7a-4c3d-9e8f-0a1b2c3d4e5f";
const CHAPTER_1 = "8a1f2e3d-4c5b-4a69-8778-695a4b3c2d1e";
const CHAPTER_2 = "9b2e3f4a-5d6c-4b7a-8988-7a6b5c4d3e2f";
const COACH = "0f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0f";
const FOLDER = "2026-09-20 Heimspiel";

const REGISTRATION = {
  id: GAME,
  playedOn: "2026-09-20",
  chapters: [
    {
      filePath: `${FOLDER}/GX010001.MP4`,
      sizeBytes: 4_000_000_000,
      durationS: 1062.495,
      frameRate: 59.94,
    },
    {
      filePath: `${FOLDER}/GX020001.MP4`,
      sizeBytes: 1_200_000_000,
      durationS: 812.08,
      frameRate: 59.94,
    },
  ],
};

function fields(overrides: Record<string, unknown> = {}) {
  return {
    id: GAME,
    title: "",
    opponent: null,
    playedOn: "2026-09-20",
    periodCount: null,
    periodLengthS: null,
    mediaHome: "mac",
    version: 1,
    revision: 3,
    quartersVersion: 1,
    ...overrides,
  };
}

const SNAPSHOT = {
  game: fields(),
  chapters: [
    {
      id: CHAPTER_1,
      orderIndex: 0,
      filePath: `${FOLDER}/GX010001.MP4`,
      durationS: 1062.495,
      frameRate: 59.94,
    },
    {
      id: CHAPTER_2,
      orderIndex: 1,
      filePath: `${FOLDER}/GX020001.MP4`,
      durationS: 812.08,
      frameRate: 59.94,
    },
  ],
  quarters: [],
  tags: [],
};

const ACCEPT = {
  title: "Heimspiel",
  opponent: "TSV Beispiel",
  playedOn: "2026-09-20",
};

function call(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: new Headers({
      authorization: `Bearer ${"f".repeat(64)}`,
      "content-type": "application/json",
      "X-HVA-App-Version": MIN_APP_VERSION,
      ...headers,
    }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  auth.getApiSession.mockResolvedValue({
    publicId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    kind: "device",
    coach: { id: COACH, email: "coach@example.test", name: "Coach" },
  });
});

describe("POST /api/app/v1/games", () => {
  const path = "/api/app/v1/games";

  it("registers a game for the session's coach and answers its snapshot", async () => {
    writes.registerMacGame.mockResolvedValue("created");
    reads.getGameSnapshot.mockResolvedValue(SNAPSHOT);

    const response = await registerGame(call("POST", path, REGISTRATION));

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(writes.registerMacGame).toHaveBeenCalledWith(
      { ...REGISTRATION, folderPath: FOLDER },
      COACH,
    );
    expect(reads.getGameSnapshot).toHaveBeenCalledWith(GAME);
    await expectGoldenPayload("game-registered", await response.json());
  });

  it("answers a retried registration with the stored snapshot", async () => {
    writes.registerMacGame.mockResolvedValue("exists");
    reads.getGameSnapshot.mockResolvedValue(SNAPSHOT);
    const response = await registerGame(call("POST", path, REGISTRATION));
    expect(response.status).toBe(200);
  });

  it.each([
    ["id_taken", "id belongs to another game"],
    ["folder_taken", "folder is already recorded"],
  ])("answers 409 when the %s", async (outcome, error) => {
    writes.registerMacGame.mockResolvedValue(outcome);
    const response = await registerGame(call("POST", path, REGISTRATION));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error });
    expect(reads.getGameSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    ["an absolute path", "/Volumes/SSD/Spiel/GX010001.MP4"],
    ["a parent segment", "../Spiel/GX010001.MP4"],
    ["a nested path", "SSD/Spiel/GX010001.MP4"],
  ])("refuses %s before any query", async (_label, filePath) => {
    const body = {
      ...REGISTRATION,
      chapters: [{ ...REGISTRATION.chapters[0], filePath }],
    };
    const response = await registerGame(call("POST", path, body));
    expect(response.status).toBe(400);
    expect(writes.registerMacGame).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    const request = new Request(`http://localhost${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${"f".repeat(64)}`,
        "X-HVA-App-Version": MIN_APP_VERSION,
      },
      body: "{",
    });
    const response = await registerGame(request);
    expect(response.status).toBe(400);
  });

  it("answers 401 without a session and 400 without the version header", async () => {
    auth.getApiSession.mockResolvedValue(null);
    expect((await registerGame(call("POST", path, REGISTRATION))).status).toBe(
      401,
    );
    const unversioned = call("POST", path, REGISTRATION);
    unversioned.headers.delete("X-HVA-App-Version");
    expect((await registerGame(unversioned)).status).toBe(400);
    expect(writes.registerMacGame).not.toHaveBeenCalled();
  });

  it("answers 500 without details when the query fails", async () => {
    writes.registerMacGame.mockRejectedValue(new Error("connection lost"));
    const response = await registerGame(call("POST", path, REGISTRATION));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "unexpected error",
    });
  });
});

describe("PATCH /api/app/v1/games/{id}", () => {
  const path = `/api/app/v1/games/${GAME}`;
  const patch = { opponent: "TSV Beispiel", playedOn: "2026-09-21" };

  it("changes the fields from the base version in If-Match", async () => {
    const game = fields({ ...patch, version: 2, revision: 4 });
    writes.updateGameFields.mockResolvedValue({ kind: "updated", game });

    const response = await patchGame(
      call("PATCH", path, patch, { "If-Match": '"1"' }),
      context(GAME),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"2"');
    expect(writes.updateGameFields).toHaveBeenCalledWith(GAME, patch, 1);
    await expectGoldenPayload("game-updated", await response.json());
  });

  it("answers 409 with the game as it is now when it moved", async () => {
    const game = fields({ opponent: "SC Anders", version: 3, revision: 5 });
    writes.updateGameFields.mockResolvedValue({ kind: "conflict", game });

    const response = await patchGame(
      call("PATCH", path, patch, { "If-Match": '"1"' }),
      context(GAME),
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("etag")).toBe('"3"');
    await expectGoldenPayload("game-conflict", await response.json());
  });

  it("answers 428 without If-Match and 400 for a malformed one", async () => {
    expect(
      (await patchGame(call("PATCH", path, patch), context(GAME))).status,
    ).toBe(428);
    expect(
      (
        await patchGame(
          call("PATCH", path, patch, { "If-Match": "*" }),
          context(GAME),
        )
      ).status,
    ).toBe(400);
    expect(writes.updateGameFields).not.toHaveBeenCalled();
  });

  it("answers 422 for a patch the review state refuses", async () => {
    writes.updateGameFields.mockResolvedValue({
      kind: "invalid",
      error: "a game under review is named by accepting it",
    });
    const response = await patchGame(
      call("PATCH", path, { title: "Heimspiel" }, { "If-Match": '"1"' }),
      context(GAME),
    );
    expect(response.status).toBe(422);
  });

  it("answers 404 for a missing game and 400 for a bad id or body", async () => {
    writes.updateGameFields.mockResolvedValue({ kind: "not_found" });
    const headers = { "If-Match": '"1"' };
    expect(
      (await patchGame(call("PATCH", path, patch, headers), context(GAME)))
        .status,
    ).toBe(404);
    expect(
      (
        await patchGame(
          call("PATCH", "/api/app/v1/games/x", patch, headers),
          context("x"),
        )
      ).status,
    ).toBe(400);
    expect(
      (await patchGame(call("PATCH", path, {}, headers), context(GAME))).status,
    ).toBe(400);
  });
});

describe("POST /api/app/v1/games/{id}/accept", () => {
  const path = `/api/app/v1/games/${GAME}/accept`;

  it("accepts the game through the review query and answers its fields", async () => {
    review.acceptImportedGame.mockResolvedValue({ updated: true });
    reads.getGameFields.mockResolvedValue(
      fields({ ...ACCEPT, version: 2, revision: 4 }),
    );

    const response = await acceptGame(
      call("POST", path, ACCEPT),
      context(GAME),
    );

    expect(response.status).toBe(200);
    expect(review.acceptImportedGame).toHaveBeenCalledWith(GAME, ACCEPT);
    await expectGoldenPayload("game-accepted", await response.json());
  });

  it("answers a retried accept with the game's fields", async () => {
    review.acceptImportedGame.mockResolvedValue({ updated: false });
    reads.getGameFields.mockResolvedValue(fields({ ...ACCEPT, version: 2 }));
    const response = await acceptGame(
      call("POST", path, ACCEPT),
      context(GAME),
    );
    expect(response.status).toBe(200);
  });

  it("answers 409 for a game accepted with other values", async () => {
    review.acceptImportedGame.mockResolvedValue({ updated: false });
    reads.getGameFields.mockResolvedValue(
      fields({ ...ACCEPT, title: "Auswärtsspiel", version: 2 }),
    );
    const response = await acceptGame(
      call("POST", path, ACCEPT),
      context(GAME),
    );
    expect(response.status).toBe(409);
    await expectGoldenPayload("game-not-under-review", await response.json());
  });

  it("answers 404 for a game that is gone", async () => {
    review.acceptImportedGame.mockResolvedValue({ updated: false });
    reads.getGameFields.mockResolvedValue(null);
    const response = await acceptGame(
      call("POST", path, ACCEPT),
      context(GAME),
    );
    expect(response.status).toBe(404);
  });

  it("applies the review's rules before the query", async () => {
    const response = await acceptGame(
      call("POST", path, { ...ACCEPT, playedOn: "" }),
      context(GAME),
    );
    expect(response.status).toBe(400);
    expect(review.acceptImportedGame).not.toHaveBeenCalled();
  });
});

describe("POST /api/app/v1/games/{id}/discard", () => {
  const path = `/api/app/v1/games/${GAME}/discard`;

  it("discards the game through the review query", async () => {
    review.discardImportedGame.mockResolvedValue({ deleted: true });
    const response = await discardGame(call("POST", path), context(GAME));
    expect(response.status).toBe(204);
    expect(review.discardImportedGame).toHaveBeenCalledWith(GAME);
  });

  it("answers a retry for a game that is gone with 204", async () => {
    review.discardImportedGame.mockResolvedValue({ deleted: false });
    reads.getGameFields.mockResolvedValue(null);
    const response = await discardGame(call("POST", path), context(GAME));
    expect(response.status).toBe(204);
  });

  it("answers 409 for an accepted game, which it never deletes", async () => {
    review.discardImportedGame.mockResolvedValue({ deleted: false });
    reads.getGameFields.mockResolvedValue(fields({ ...ACCEPT, version: 2 }));
    const response = await discardGame(call("POST", path), context(GAME));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "game is not under review",
      game: { id: GAME },
    });
  });

  it("answers 401 without a session", async () => {
    auth.getApiSession.mockResolvedValue(null);
    const response = await discardGame(call("POST", path), context(GAME));
    expect(response.status).toBe(401);
    expect(review.discardImportedGame).not.toHaveBeenCalled();
  });
});
