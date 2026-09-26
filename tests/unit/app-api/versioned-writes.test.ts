import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the drizzle chains: every step returns the chain, and awaiting
// it yields the next queued rows. `ops` records which statements ran, so the
// tests pin that a stale base version writes nothing (ADR 0013, Mac plan S3).
// The versions themselves are bumped by database triggers, which the migration
// test and a real database cover; here the queries only read them back.
const db = vi.hoisted(() => {
  const results: unknown[][] = [];
  const ops: string[] = [];
  const chain = (op: string) => () => {
    ops.push(op);
    const step: Record<string, unknown> = {};
    for (const method of [
      "from",
      "where",
      "for",
      "limit",
      "orderBy",
      "set",
      "values",
      "returning",
      "onConflictDoNothing",
      "onConflictDoUpdate",
    ]) {
      step[method] = () => step;
    }
    step.then = (
      resolve: (rows: unknown[]) => unknown,
      reject: (cause: unknown) => unknown,
    ) => Promise.resolve(results.shift() ?? []).then(resolve, reject);
    return step;
  };
  const client = {
    select: vi.fn(chain("select")),
    update: vi.fn(chain("update")),
    insert: vi.fn(chain("insert")),
    delete: vi.fn(chain("delete")),
    transaction: vi.fn(
      async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
        run(client),
    ),
  };
  return { results, ops, client };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import { replaceQuarters } from "@/features/quarters/queries";
import { setTagPlayers } from "@/features/tag-players/queries";
import { deleteTag, updateTag } from "@/features/tagging/edit/queries";
import { insertTag } from "@/features/tagging/queries";

const GAME = "5d9c1f0e-2b7a-4c3d-9e8f-0a1b2c3d4e5f";
const OTHER_GAME = "6e0d2a1f-3c8b-4d4e-8f9a-1b2c3d4e5f6a";
const TAG = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const PLAYER_A = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const COACH = "0f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0f";

const TAG_ROW = {
  id: TAG,
  gameId: GAME,
  type: "goal",
  startS: 988,
  endS: 1005,
  visibility: "single",
  version: 5,
};

beforeEach(() => {
  db.results.length = 0;
  db.ops.length = 0;
  vi.clearAllMocks();
});

describe("insertTag", () => {
  const input = {
    id: TAG,
    gameId: GAME,
    type: "goal",
    startS: 990,
    endS: 1005,
    authorId: COACH,
  };

  it("creates a new tag", async () => {
    db.results.push([{ ...TAG_ROW, version: 1 }]);
    await expect(insertTag(input)).resolves.toMatchObject({
      status: "created",
      tag: { id: TAG, version: 1 },
    });
    expect(db.ops).toEqual(["insert"]);
  });

  it("returns the stored tag for a retried create", async () => {
    db.results.push([], [TAG_ROW]);
    await expect(insertTag(input)).resolves.toEqual({
      status: "stored",
      tag: TAG_ROW,
    });
  });

  it("matches the game however the client cased its id", async () => {
    db.results.push([], [TAG_ROW]);
    await expect(
      insertTag({ ...input, gameId: GAME.toUpperCase() }),
    ).resolves.toMatchObject({ status: "stored" });
  });

  it("reports an id taken by another game's tag", async () => {
    db.results.push([], [{ ...TAG_ROW, gameId: OTHER_GAME }]);
    await expect(insertTag(input)).resolves.toEqual({ status: "taken" });
  });
});

describe("updateTag", () => {
  const edit = { type: "goal", startS: 988, endS: 1005 };
  const before = { type: "goal", startS: 988, endS: 1005, version: 5 };

  it("edits a tag still at its base version", async () => {
    db.results.push([before], [{ ...TAG_ROW, version: 6 }]);
    await expect(updateTag(TAG, edit, 5)).resolves.toMatchObject({
      status: "done",
      value: { version: 6 },
    });
    expect(db.ops).toEqual(["select", "update"]);
  });

  it("writes nothing and returns the current tag when it moved", async () => {
    db.results.push([before], [TAG_ROW], [{ playerId: PLAYER_A }]);
    await expect(updateTag(TAG, edit, 4)).resolves.toEqual({
      status: "conflict",
      current: { ...TAG_ROW, playerIds: [PLAYER_A] },
    });
    expect(db.ops).not.toContain("update");
  });

  it("edits without a base version, as the web does", async () => {
    db.results.push([{ ...before, version: 9 }], [TAG_ROW]);
    await expect(updateTag(TAG, edit)).resolves.toMatchObject({
      status: "done",
    });
  });

  it("reports a tag that does not exist", async () => {
    db.results.push([]);
    await expect(updateTag(TAG, edit, 1)).resolves.toEqual({
      status: "not-found",
    });
  });
});

describe("deleteTag", () => {
  it("deletes a tag still at its base version", async () => {
    db.results.push([{ id: TAG }]);
    await expect(deleteTag(TAG, 5)).resolves.toEqual({
      status: "done",
      value: null,
    });
  });

  it("keeps a tag that moved and returns it", async () => {
    db.results.push([], [TAG_ROW], []);
    await expect(deleteTag(TAG, 4)).resolves.toEqual({
      status: "conflict",
      current: { ...TAG_ROW, playerIds: [] },
    });
  });

  it("reports a tag that is already gone", async () => {
    db.results.push([], []);
    await expect(deleteTag(TAG, 4)).resolves.toEqual({ status: "not-found" });
    db.results.push([]);
    await expect(deleteTag(TAG)).resolves.toEqual({ status: "not-found" });
  });
});

describe("setTagPlayers", () => {
  const input = { visibility: "single" as const, playerIds: [PLAYER_A] };

  it("writes only what changed and returns the new version", async () => {
    // Visibility is already `single`: only the links are written.
    db.results.push(
      [{ visibility: "single", version: 5 }],
      [],
      [],
      [{ version: 6 }],
    );
    await expect(setTagPlayers(TAG, input, 5)).resolves.toEqual({
      status: "done",
      value: { ...input, version: 6 },
    });
    expect(db.ops).toEqual(["select", "delete", "insert", "select"]);
  });

  it("updates the visibility when it changed", async () => {
    db.results.push(
      [{ visibility: "team", version: 5 }],
      [],
      [],
      [],
      [{ version: 7 }],
    );
    await setTagPlayers(TAG, input, null);
    expect(db.ops).toEqual(["select", "update", "delete", "insert", "select"]);
  });

  it("writes nothing and returns the current tag when it moved", async () => {
    db.results.push([{ visibility: "single", version: 6 }], [TAG_ROW], []);
    await expect(setTagPlayers(TAG, input, 5)).resolves.toMatchObject({
      status: "conflict",
      current: { version: 5 },
    });
    expect(db.ops).toEqual(["select", "select", "select"]);
  });
});

describe("replaceQuarters", () => {
  const input = {
    gameId: GAME,
    quarters: [{ index: 1, startS: 0, endS: 900 }],
  };
  const row = { id: "q1", gameId: GAME, index: 1, startS: 0, endS: 900 };

  it("saves a set still at its base version", async () => {
    db.results.push([{ version: 3 }], [], [], [{ version: 4 }], [row]);
    await expect(replaceQuarters(input, 3)).resolves.toEqual({
      status: "done",
      value: { quarters: [row], version: 4 },
    });
    expect(db.ops).toEqual(["select", "delete", "insert", "select", "select"]);
  });

  it("writes nothing and returns the current set when it moved", async () => {
    db.results.push([{ version: 4 }], [row]);
    await expect(replaceQuarters(input, 3)).resolves.toEqual({
      status: "conflict",
      current: { quarters: [row], version: 4 },
    });
    expect(db.ops).toEqual(["select", "select"]);
  });

  it("reports a game that does not exist", async () => {
    db.results.push([]);
    await expect(replaceQuarters(input)).resolves.toEqual({
      status: "not-found",
    });
  });
});
