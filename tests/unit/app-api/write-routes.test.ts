import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectGoldenPayload } from "./golden";

// The tag and quarter write routes the Mac calls (ADR 0013, Mac plan S3),
// against mocked queries: what matters is that the bearer session is accepted,
// that `If-Match` reaches the query as the base version (or null without the
// header, as the web sends), and the status codes and bodies the Mac relies
// on. The bodies are pinned as golden payloads in `contracts/api/`.
const auth = vi.hoisted(() => ({ getApiSession: vi.fn() }));
const tagging = vi.hoisted(() => ({ insertTag: vi.fn() }));
const tagEdit = vi.hoisted(() => ({ updateTag: vi.fn(), deleteTag: vi.fn() }));
const tagPlayers = vi.hoisted(() => ({
  getTagPlayers: vi.fn(),
  setTagPlayers: vi.fn(),
}));
const quarterQueries = vi.hoisted(() => ({
  listQuarters: vi.fn(),
  replaceQuarters: vi.fn(),
}));
const gameFormat = vi.hoisted(() => ({ getGameFormat: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/features/tagging/queries", () => tagging);
vi.mock("@/features/tagging/edit/queries", () => tagEdit);
vi.mock("@/features/tag-players/queries", () => tagPlayers);
vi.mock("@/features/quarters/queries", () => quarterQueries);
vi.mock("@/features/game-format/queries", () => gameFormat);

import { PUT as putQuarters } from "@/app/api/quarters/route";
import { PUT as putTagPlayers } from "@/app/api/tags/[id]/players/route";
import {
  DELETE as deleteTag,
  PATCH as patchTag,
} from "@/app/api/tags/[id]/route";
import { POST as postTag } from "@/app/api/tags/route";

const GAME = "5d9c1f0e-2b7a-4c3d-9e8f-0a1b2c3d4e5f";
const TAG = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const COACH = "0f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0f";
const PLAYER_A = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const QUARTER_1 = "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f";
const QUARTER_2 = "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f7a";

const CREATED = {
  id: TAG,
  gameId: GAME,
  type: "goal",
  startS: 990,
  endS: 1005,
  visibility: "team",
  source: "manual",
  authorId: COACH,
  version: 1,
  createdAt: new Date("2026-09-20T15:04:05.000Z"),
};

const CURRENT = {
  id: TAG,
  gameId: GAME,
  type: "goal",
  startS: 988,
  endS: 1005,
  visibility: "single",
  playerIds: [PLAYER_A],
  version: 5,
};

function call(
  method: string,
  path: string,
  body?: unknown,
  ifMatch: string | null = null,
) {
  const headers = new Headers({
    authorization: `Bearer ${"f".repeat(64)}`,
    "content-type": "application/json",
  });
  if (ifMatch !== null) headers.set("If-Match", ifMatch);
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const tagContext = { params: Promise.resolve({ id: TAG }) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  auth.getApiSession.mockResolvedValue({
    publicId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    kind: "device",
    coach: { id: COACH, email: "coach@example.test", name: "Coach" },
  });
  gameFormat.getGameFormat.mockResolvedValue({
    periodCount: 4,
    periodLengthS: 900,
  });
});

describe("POST /api/tags", () => {
  const body = { id: TAG, gameId: GAME, type: "goal", startS: 990, endS: 1005 };

  it("stores a tag under the client's id and the session's coach", async () => {
    tagging.insertTag.mockResolvedValue({ status: "created", tag: CREATED });

    const response = await postTag(call("POST", "/api/tags", body));

    expect(response.status).toBe(201);
    expect(response.headers.get("etag")).toBe('"1"');
    expect(tagging.insertTag).toHaveBeenCalledWith({
      ...body,
      authorId: COACH,
    });
    const json: unknown = await response.json();
    await expectGoldenPayload("tag-created", json);
  });

  it("answers a retried create with the stored tag", async () => {
    tagging.insertTag.mockResolvedValue({
      status: "stored",
      tag: { ...CREATED, version: 3 },
    });

    const response = await postTag(call("POST", "/api/tags", body));

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"3"');
    await expect(response.json()).resolves.toMatchObject({
      tag: { id: TAG, version: 3 },
    });
  });

  it("answers 409 when the id belongs to another game's tag", async () => {
    tagging.insertTag.mockResolvedValue({ status: "taken" });
    const response = await postTag(call("POST", "/api/tags", body));
    expect(response.status).toBe(409);
  });

  it("still stores a tag without a client id, as the web sends it", async () => {
    tagging.insertTag.mockResolvedValue({ status: "created", tag: CREATED });
    const web = { gameId: GAME, type: "goal", startS: 990, endS: 1005 };
    const response = await postTag(call("POST", "/api/tags", web));
    expect(response.status).toBe(201);
    expect(tagging.insertTag).toHaveBeenCalledWith({ ...web, authorId: COACH });
  });

  it("refuses a malformed client id", async () => {
    const response = await postTag(
      call("POST", "/api/tags", { ...body, id: "tag-1" }),
    );
    expect(response.status).toBe(400);
    expect(tagging.insertTag).not.toHaveBeenCalled();
  });

  it("answers 401 without a session", async () => {
    auth.getApiSession.mockResolvedValue(null);
    const response = await postTag(call("POST", "/api/tags", body));
    expect(response.status).toBe(401);
    expect(tagging.insertTag).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/tags/[id]", () => {
  const edit = { type: "goal", startS: 988, endS: 1005 };

  it("edits from the base version in If-Match", async () => {
    tagEdit.updateTag.mockResolvedValue({
      status: "done",
      value: { id: TAG, ...edit, visibility: "team", version: 5 },
    });

    const response = await patchTag(
      call("PATCH", `/api/tags/${TAG}`, edit, '"4"'),
      tagContext,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"5"');
    expect(tagEdit.updateTag).toHaveBeenCalledWith(TAG, edit, 4);
    await expectGoldenPayload("tag-updated", await response.json());
  });

  it("edits without the check when the header is missing", async () => {
    tagEdit.updateTag.mockResolvedValue({
      status: "done",
      value: { id: TAG, ...edit, visibility: "team", version: 5 },
    });
    await patchTag(call("PATCH", `/api/tags/${TAG}`, edit), tagContext);
    expect(tagEdit.updateTag).toHaveBeenCalledWith(TAG, edit, null);
  });

  it("answers 409 with the tag as it is now when it moved", async () => {
    tagEdit.updateTag.mockResolvedValue({
      status: "conflict",
      current: CURRENT,
    });

    const response = await patchTag(
      call("PATCH", `/api/tags/${TAG}`, edit, '"4"'),
      tagContext,
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("etag")).toBe('"5"');
    const json: unknown = await response.json();
    expect(json).toEqual({ error: "version conflict", tag: CURRENT });
    await expectGoldenPayload("tag-conflict", json);
  });

  it("refuses an If-Match that names no single version", async () => {
    const response = await patchTag(
      call("PATCH", `/api/tags/${TAG}`, edit, "*"),
      tagContext,
    );
    expect(response.status).toBe(400);
    expect(tagEdit.updateTag).not.toHaveBeenCalled();
  });

  it("answers 404 for a tag that is gone", async () => {
    tagEdit.updateTag.mockResolvedValue({ status: "not-found" });
    const response = await patchTag(
      call("PATCH", `/api/tags/${TAG}`, edit, '"4"'),
      tagContext,
    );
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/tags/[id]", () => {
  it("deletes from the base version in If-Match", async () => {
    tagEdit.deleteTag.mockResolvedValue({ status: "done", value: null });
    const response = await deleteTag(
      call("DELETE", `/api/tags/${TAG}`, undefined, '"5"'),
      tagContext,
    );
    expect(response.status).toBe(204);
    expect(tagEdit.deleteTag).toHaveBeenCalledWith(TAG, 5);
  });

  it("keeps a tag that moved and answers 409 with it", async () => {
    tagEdit.deleteTag.mockResolvedValue({
      status: "conflict",
      current: CURRENT,
    });
    const response = await deleteTag(
      call("DELETE", `/api/tags/${TAG}`, undefined, '"4"'),
      tagContext,
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "version conflict",
      tag: CURRENT,
    });
  });

  it("deletes without the check when the header is missing", async () => {
    tagEdit.deleteTag.mockResolvedValue({ status: "not-found" });
    const response = await deleteTag(
      call("DELETE", `/api/tags/${TAG}`),
      tagContext,
    );
    expect(response.status).toBe(404);
    expect(tagEdit.deleteTag).toHaveBeenCalledWith(TAG, null);
  });
});

describe("PUT /api/tags/[id]/players", () => {
  const body = { visibility: "single", playerIds: [PLAYER_A] };

  it("saves the players from the base version in If-Match", async () => {
    tagPlayers.setTagPlayers.mockResolvedValue({
      status: "done",
      value: { ...body, version: 6 },
    });

    const response = await putTagPlayers(
      call("PUT", `/api/tags/${TAG}/players`, body, '"5"'),
      tagContext,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"6"');
    expect(tagPlayers.setTagPlayers).toHaveBeenCalledWith(TAG, body, 5);
    await expectGoldenPayload("tag-players-saved", await response.json());
  });

  it("answers 409 with the tag as it is now when it moved", async () => {
    tagPlayers.setTagPlayers.mockResolvedValue({
      status: "conflict",
      current: CURRENT,
    });
    const response = await putTagPlayers(
      call("PUT", `/api/tags/${TAG}/players`, body, '"4"'),
      tagContext,
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "version conflict",
      tag: CURRENT,
    });
  });

  it("saves without the check when the header is missing", async () => {
    tagPlayers.setTagPlayers.mockResolvedValue({
      status: "done",
      value: { ...body, version: 6 },
    });
    await putTagPlayers(
      call("PUT", `/api/tags/${TAG}/players`, body),
      tagContext,
    );
    expect(tagPlayers.setTagPlayers).toHaveBeenCalledWith(TAG, body, null);
  });
});

describe("PUT /api/quarters", () => {
  const body = {
    gameId: GAME,
    quarters: [
      { index: 1, startS: 12.5, endS: 912.5 },
      { index: 2, startS: 1030, endS: null },
    ],
  };
  const saved = {
    quarters: body.quarters.map((quarter, i) => ({
      id: [QUARTER_1, QUARTER_2][i],
      gameId: GAME,
      ...quarter,
    })),
    version: 6,
  };

  it("saves the set from the base version in If-Match", async () => {
    quarterQueries.replaceQuarters.mockResolvedValue({
      status: "done",
      value: saved,
    });

    const response = await putQuarters(
      call("PUT", "/api/quarters", body, '"5"'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"6"');
    expect(quarterQueries.replaceQuarters).toHaveBeenCalledWith(body, 5);
    await expectGoldenPayload("quarters-saved", await response.json());
  });

  it("answers 409 with the current set when it moved", async () => {
    quarterQueries.replaceQuarters.mockResolvedValue({
      status: "conflict",
      current: saved,
    });

    const response = await putQuarters(
      call("PUT", "/api/quarters", body, '"4"'),
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("etag")).toBe('"6"');
    const json: unknown = await response.json();
    expect(json).toEqual({ error: "version conflict", ...saved });
    await expectGoldenPayload("quarters-conflict", json);
  });

  it("saves without the check when the header is missing", async () => {
    quarterQueries.replaceQuarters.mockResolvedValue({
      status: "done",
      value: saved,
    });
    const response = await putQuarters(call("PUT", "/api/quarters", body));
    expect(response.status).toBe(200);
    expect(quarterQueries.replaceQuarters).toHaveBeenCalledWith(body, null);
  });

  it("answers 400 for a game that is gone", async () => {
    quarterQueries.replaceQuarters.mockResolvedValue({ status: "not-found" });
    const response = await putQuarters(call("PUT", "/api/quarters", body));
    expect(response.status).toBe(400);
  });
});
