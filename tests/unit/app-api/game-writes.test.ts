import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the drizzle chains, as in the versioned-writes tests: every
// step returns the chain, and awaiting it yields the next queued rows. `ops`
// records which statements ran and `values` what they wrote, so the tests pin
// what a registration stores and that a refused write stores nothing (ADR
// 0013, Mac plan S4). Unique keys and the triggers are the database's; here
// the queued rows play its answers.
const db = vi.hoisted(() => {
  const results: unknown[][] = [];
  const ops: string[] = [];
  const values: unknown[] = [];
  const chain = (op: string) => () => {
    ops.push(op);
    const step: Record<string, unknown> = {};
    for (const method of [
      "from",
      "where",
      "for",
      "limit",
      "orderBy",
      "returning",
      "onConflictDoNothing",
      "onConflictDoUpdate",
    ]) {
      step[method] = () => step;
    }
    step.values = (rows: unknown) => {
      values.push(rows);
      return step;
    };
    step.set = (fields: unknown) => {
      values.push(fields);
      return step;
    };
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
    transaction: vi.fn(
      async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
        run(client),
    ),
  };
  return { results, ops, values, client };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import {
  registerMacGame,
  registrationParts,
  updateGameFields,
} from "@/features/app-api/games";
import type { GameRegistration } from "@/features/app-api/validation";

const GAME = "5d9c1f0e-2b7a-4c3d-9e8f-0a1b2c3d4e5f";
const FOLDER_ROW = "e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b";
const COACH = "0f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0f";
const FOLDER = "2026-09-20 Heimspiel";

const REGISTRATION: GameRegistration = {
  id: GAME,
  folderPath: FOLDER,
  playedOn: "2026-09-20",
  chapters: [
    {
      filePath: `${FOLDER}/GX020001.MP4`,
      sizeBytes: 1_200_000_000,
      durationS: 812.08,
      frameRate: null,
    },
    {
      filePath: `${FOLDER}/GX010001.MP4`,
      sizeBytes: 4_000_000_000,
      durationS: 1062.495,
      frameRate: 59.94,
    },
  ],
};

const PARTS = "GX010001.MP4\t4000000000\nGX020001.MP4\t1200000000";

const STORED_CHAPTERS = REGISTRATION.chapters.map((chapter) => ({
  filePath: chapter.filePath,
  durationS: chapter.durationS,
}));

function gameFields(overrides: Record<string, unknown> = {}) {
  return {
    id: GAME,
    title: "",
    opponent: null,
    playedOn: "2026-09-20",
    periodCount: null,
    periodLengthS: null,
    mediaHome: "mac",
    version: 2,
    revision: 7,
    quartersVersion: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.results.length = 0;
  db.ops.length = 0;
  db.values.length = 0;
});

describe("registrationParts", () => {
  it("records the chapters' names and sizes as the Drive scan does", () => {
    expect(registrationParts(REGISTRATION)).toBe(PARTS);
  });
});

describe("registerMacGame", () => {
  it("stores a mac game under review, its chapters in order and its folder", async () => {
    db.results.push([{ id: GAME }], [], [{ id: FOLDER_ROW }]);

    await expect(registerMacGame(REGISTRATION, COACH)).resolves.toBe("created");

    expect(db.ops).toEqual(["insert", "insert", "insert"]);
    const [game, chapters, folder] = db.values;
    expect(game).toEqual({
      id: GAME,
      title: "",
      opponent: null,
      playedOn: "2026-09-20",
      createdBy: COACH,
      mediaHome: "mac",
    });
    expect(chapters).toEqual([
      {
        gameId: GAME,
        orderIndex: 0,
        filePath: `${FOLDER}/GX020001.MP4`,
        durationS: 812.08,
        frameRate: null,
      },
      {
        gameId: GAME,
        orderIndex: 1,
        filePath: `${FOLDER}/GX010001.MP4`,
        durationS: 1062.495,
        frameRate: 59.94,
      },
    ]);
    expect(folder).toEqual({
      folderPath: FOLDER,
      status: "imported",
      gameId: GAME,
      parts: PARTS,
    });
  });

  it("rolls the game back when the folder is recorded already", async () => {
    db.results.push([{ id: GAME }], [], []);
    await expect(registerMacGame(REGISTRATION, COACH)).resolves.toBe(
      "folder_taken",
    );
  });

  it("answers a retry of the same registration without writing", async () => {
    db.results.push(
      [],
      [{ mediaHome: "mac" }],
      [{ parts: PARTS }],
      STORED_CHAPTERS,
    );
    await expect(registerMacGame(REGISTRATION, COACH)).resolves.toBe("exists");
    expect(db.ops).toEqual(["insert", "select", "select", "select"]);
  });

  it.each([
    ["a Drive game", [[{ mediaHome: "drive" }]]],
    ["a game in another folder", [[{ mediaHome: "mac" }], []]],
    [
      "a game whose files differ",
      [[{ mediaHome: "mac" }], [{ parts: "GX010001.MP4\t1" }]],
    ],
    [
      "a game with other durations",
      [
        [{ mediaHome: "mac" }],
        [{ parts: PARTS }],
        [STORED_CHAPTERS[0], { ...STORED_CHAPTERS[1], durationS: 1000 }],
      ],
    ],
    [
      "a game with fewer chapters",
      [[{ mediaHome: "mac" }], [{ parts: PARTS }], [STORED_CHAPTERS[0]]],
    ],
  ])("refuses an id that belongs to %s", async (_label, rows) => {
    db.results.push([], ...rows);
    await expect(registerMacGame(REGISTRATION, COACH)).resolves.toBe(
      "id_taken",
    );
    expect(db.ops.filter((op) => op === "insert")).toHaveLength(1);
  });
});

describe("updateGameFields", () => {
  it("writes the patch from the base version and answers the new fields", async () => {
    const updated = gameFields({ opponent: "TSV Beispiel", version: 3 });
    db.results.push([{ id: GAME }], [gameFields()], [updated]);

    await expect(
      updateGameFields(GAME, { opponent: "TSV Beispiel" }, 2),
    ).resolves.toEqual({ kind: "updated", game: updated });
    expect(db.ops).toEqual(["select", "select", "update"]);
    expect(db.values).toEqual([{ opponent: "TSV Beispiel" }]);
  });

  it("writes nothing when the game moved past the base version", async () => {
    const current = gameFields({ version: 4 });
    db.results.push([{ id: GAME }], [current]);

    await expect(
      updateGameFields(GAME, { opponent: "TSV Beispiel" }, 2),
    ).resolves.toEqual({ kind: "conflict", game: current });
    expect(db.ops).not.toContain("update");
  });

  it("writes nothing for a patch the review state refuses", async () => {
    db.results.push([{ id: GAME }], [gameFields()]);

    await expect(
      updateGameFields(GAME, { title: "Heimspiel" }, 2),
    ).resolves.toMatchObject({ kind: "invalid" });
    expect(db.ops).not.toContain("update");
  });

  it("answers not_found for a missing or hidden game", async () => {
    db.results.push([]);
    await expect(
      updateGameFields(GAME, { opponent: null }, 1),
    ).resolves.toEqual({ kind: "not_found" });
  });
});
