import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the drizzle chains: every step returns the chain, and
// awaiting it yields the next queued result, so the tests pin what the
// queries do with the stored rows without a database.
const db = vi.hoisted(() => {
  const results: unknown[] = [];
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const chain = () => {
    const step: Record<string, unknown> = {};
    for (const method of [
      "from",
      "innerJoin",
      "where",
      "groupBy",
      "orderBy",
      "limit",
      "returning",
      "onConflictDoNothing",
    ]) {
      step[method] = () => step;
    }
    step.values = (values: unknown) => {
      inserts.push(values);
      return step;
    };
    step.set = (values: unknown) => {
      updates.push(values);
      return step;
    };
    step.then = (resolve: (rows: unknown) => unknown) =>
      Promise.resolve(results.shift() ?? []).then(resolve);
    return step;
  };
  const client = {
    select: vi.fn(chain),
    selectDistinct: vi.fn(chain),
    insert: vi.fn(chain),
    update: vi.fn(chain),
    delete: vi.fn(chain),
    transaction: vi.fn(
      async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
        run(client),
    ),
  };
  return { results, inserts, updates, client };
});

vi.mock("@/lib/db", () => ({ db: db.client }));
vi.mock("@/features/tag-windows/queries", async () => {
  const { DEFAULT_TAG_WINDOWS } = await import("@/lib/tag-types");
  return { getTagWindows: async () => DEFAULT_TAG_WINDOWS };
});

import {
  linkExecutions,
  listExecutionStats,
  listSceneExecutions,
  listTagSceneChoices,
  setExecutionOutcome,
  unlinkExecution,
} from "@/features/tactics/executions/queries";

const SCENE_ID = "11111111-1111-4111-8111-111111111111";
const GAME_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GAME_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => {
  db.results.length = 0;
  db.inserts.length = 0;
  db.updates.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("linkExecutions", () => {
  it("links nothing to a scene that does not exist", async () => {
    db.results.push([]);
    expect(await linkExecutions(SCENE_ID, ["t1"])).toBeNull();
    expect(db.client.insert).not.toHaveBeenCalled();
  });

  it("starts a corner with a goal in its window as a success, others open", async () => {
    db.results.push(
      [{ id: SCENE_ID }],
      [
        {
          id: "t1",
          gameId: GAME_A,
          type: "corner_short",
          startS: 600,
          endS: 614,
        },
        {
          id: "t2",
          gameId: GAME_A,
          type: "corner_short",
          startS: 900,
          endS: null,
        },
        {
          id: "t3",
          gameId: GAME_B,
          type: "corner_short",
          startS: 600,
          endS: 614,
        },
      ],
      // Goal tags of games A and B: only one inside a corner's window, and
      // game B's goal sits in game A's corner time, which must not count.
      [
        { gameId: GAME_A, type: "goal", startS: 605, endS: null },
        { gameId: GAME_B, type: "goal", startS: 2000, endS: 2015 },
      ],
      [{ tagId: "t1" }, { tagId: "t2" }, { tagId: "t3" }],
    );
    expect(await linkExecutions(SCENE_ID, ["t1", "t2", "t3"])).toBe(3);
    expect(db.inserts).toEqual([
      [
        { sceneId: SCENE_ID, tagId: "t1", outcome: "success" },
        { sceneId: SCENE_ID, tagId: "t2", outcome: "open" },
        { sceneId: SCENE_ID, tagId: "t3", outcome: "open" },
      ],
    ]);
  });

  it("skips unknown tags and counts only the links it added", async () => {
    db.results.push([{ id: SCENE_ID }], []);
    expect(await linkExecutions(SCENE_ID, ["gone"])).toBe(0);
    expect(db.client.insert).not.toHaveBeenCalled();

    db.results.push(
      [{ id: SCENE_ID }],
      [{ id: "t1", gameId: GAME_A, type: "action_good", startS: 10, endS: 22 }],
      [],
      // Already linked: the conflict leaves it alone and returns no row.
      [],
    );
    expect(await linkExecutions(SCENE_ID, ["t1"])).toBe(0);
  });
});

describe("listExecutionStats", () => {
  it("counts each scene's executions by outcome", async () => {
    db.results.push([
      { sceneId: "s1", outcome: "success", n: 3 },
      { sceneId: "s1", outcome: "failure", n: 1 },
      { sceneId: "s2", outcome: "open", n: 2 },
    ]);
    const stats = await listExecutionStats();
    expect(stats.get("s1")).toEqual({
      total: 4,
      success: 3,
      failure: 1,
      open: 0,
    });
    expect(stats.get("s2")).toEqual({
      total: 2,
      success: 0,
      failure: 0,
      open: 2,
    });
    expect(stats.has("s3")).toBe(false);
  });
});

describe("listSceneExecutions", () => {
  const row = (tagId: string, playedOn: string, startS: number) => ({
    tagId,
    tagType: "corner_short",
    extraTypes: [],
    startS,
    endS: null,
    gameId: playedOn === "2026-05-10" ? GAME_B : GAME_A,
    gameTitle: "Spiel",
    gameOpponent: null,
    playedOn,
    outcome: "open",
    chapters: [{ durationS: 5000, frameRate: 25 }],
  });

  it("plays newest game first with each tag's newest clip", async () => {
    db.results.push(
      [
        row("old", "2026-04-01", 100),
        row("late", "2026-05-10", 900),
        row("early", "2026-05-10", 50),
      ],
      // Clips newest first: "late" was re-cut after a failed first cut.
      [
        {
          tagId: "late",
          id: "c3",
          status: "ready",
          outputPath: "b.mp4",
          cutStartS: 891,
        },
        {
          tagId: "late",
          id: "c1",
          status: "failed",
          outputPath: null,
          cutStartS: null,
        },
        {
          tagId: "old",
          id: "c2",
          status: "pending",
          outputPath: null,
          cutStartS: null,
        },
      ],
    );
    const executions = await listSceneExecutions(SCENE_ID);
    expect(executions.map((execution) => execution.tagId)).toEqual([
      "early",
      "late",
      "old",
    ]);
    expect(executions.map((execution) => execution.clip?.id ?? null)).toEqual([
      null,
      "c3",
      "c2",
    ]);
    // A tag without its own end gets its type's window.
    expect(executions[0]).toMatchObject({ endS: 56, frameRate: 25 });
  });
});

describe("setExecutionOutcome and unlinkExecution", () => {
  it("say whether the tag was linked to the scene", async () => {
    db.results.push([{ tagId: "t1" }], []);
    expect(await setExecutionOutcome(SCENE_ID, "t1", "failure")).toBe(true);
    expect(db.updates).toEqual([{ outcome: "failure" }]);
    expect(await setExecutionOutcome(SCENE_ID, "t2", "success")).toBe(false);

    db.results.push([{ tagId: "t1" }], []);
    expect(await unlinkExecution(SCENE_ID, "t1")).toBe(true);
    expect(await unlinkExecution(SCENE_ID, "t1")).toBe(false);
  });
});

describe("listTagSceneChoices", () => {
  it("is null for a tag that does not exist", async () => {
    db.results.push([]);
    expect(await listTagSceneChoices("gone")).toBeNull();
  });

  it("lists every scene with how the tag's link to it stands", async () => {
    db.results.push(
      [{ id: "t1" }],
      [
        { id: "s1", name: "Ecke Variante 1" },
        { id: "s2", name: "Ecke Variante 2" },
      ],
      [{ sceneId: "s2", outcome: "success" }],
    );
    expect(await listTagSceneChoices("t1")).toEqual([
      { id: "s1", name: "Ecke Variante 1", outcome: null },
      { id: "s2", name: "Ecke Variante 2", outcome: "success" },
    ]);
  });
});
