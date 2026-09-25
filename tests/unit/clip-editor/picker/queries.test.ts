import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the drizzle chains: every step returns the chain, and awaiting
// it yields the next queued result (or rejects with a queued error), so the
// tests pin what the queries do with their rows without a database.
const db = vi.hoisted(() => {
  const results: unknown[] = [];
  const inserted: { values: unknown }[] = [];
  const chain = () => {
    const step: Record<string, unknown> = {};
    for (const method of [
      "from",
      "innerJoin",
      "leftJoin",
      "where",
      "orderBy",
      "limit",
      "onConflictDoNothing",
      "returning",
    ]) {
      step[method] = () => step;
    }
    step.values = (values: unknown) => {
      inserted.push({ values });
      return step;
    };
    step.then = (
      resolve: (rows: unknown) => unknown,
      reject: (cause: unknown) => unknown,
    ) => {
      const next = results.shift() ?? [];
      return (
        next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
      ).then(resolve, reject);
    };
    return step;
  };
  const client = {
    select: vi.fn(chain),
    insert: vi.fn(chain),
    transaction: vi.fn(
      async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
        run(client),
    ),
  };
  return { results, inserted, client };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import { getPickerData } from "@/features/clip-editor/picker/queries";
import {
  addClipToCollection,
  createCollectionWithClip,
} from "@/features/share/collections/queries";

const COLLECTION = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";
const CLIP = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const GAME = "11111111-1111-4111-8111-111111111111";
const PLAYER = "a1111111-1111-4111-8111-111111111111";

function uniqueViolation(): Error {
  return Object.assign(new Error("duplicate key"), { code: "23505" });
}

beforeEach(() => {
  db.results.length = 0;
  db.inserted.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("addClipToCollection", () => {
  it("adds a ready clip", async () => {
    db.results.push([{ id: COLLECTION }], [{ id: CLIP }], [{ clipId: CLIP }]);
    expect(await addClipToCollection(COLLECTION, CLIP)).toBe("added");
    expect(db.inserted).toEqual([
      { values: { collectionId: COLLECTION, clipId: CLIP } },
    ]);
  });

  it("refuses a clip already in the collection", async () => {
    // The insert skips the existing row, so it returns none.
    db.results.push([{ id: COLLECTION }], [{ id: CLIP }], []);
    expect(await addClipToCollection(COLLECTION, CLIP)).toBe("duplicate");
  });

  it("refuses a clip that is not ready, adding nothing", async () => {
    db.results.push([{ id: COLLECTION }], []);
    expect(await addClipToCollection(COLLECTION, CLIP)).toBe("clip-not-ready");
    expect(db.client.insert).not.toHaveBeenCalled();
  });

  it("reports an unknown collection", async () => {
    db.results.push([]);
    expect(await addClipToCollection(COLLECTION, CLIP)).toBe("missing");
    expect(db.client.insert).not.toHaveBeenCalled();
  });
});

describe("createCollectionWithClip", () => {
  const input = { name: "Ecken", createdBy: "coach-1", clipId: CLIP };

  it("creates the collection holding the clip", async () => {
    db.results.push([{ id: CLIP }], [{ id: COLLECTION, shareToken: "t" }], []);
    expect(await createCollectionWithClip(input)).toEqual({
      id: COLLECTION,
      shareToken: "t",
    });
    expect(db.inserted[0]?.values).toMatchObject({
      name: "Ecken",
      createdBy: "coach-1",
    });
    expect(db.inserted[1]).toEqual({
      values: { collectionId: COLLECTION, clipId: CLIP },
    });
  });

  it("creates nothing for a clip that is not ready", async () => {
    db.results.push([]);
    expect(await createCollectionWithClip(input)).toBeNull();
    expect(db.client.insert).not.toHaveBeenCalled();
  });

  it("retries the whole transaction on a share token collision", async () => {
    db.results.push(
      [{ id: CLIP }],
      uniqueViolation(),
      [{ id: CLIP }],
      [{ id: COLLECTION, shareToken: "t2" }],
      [],
    );
    expect(await createCollectionWithClip(input)).toEqual({
      id: COLLECTION,
      shareToken: "t2",
    });
    expect(db.client.transaction).toHaveBeenCalledTimes(2);
  });

  it("gives up on any other error", async () => {
    db.results.push([{ id: CLIP }], new Error("connection lost"));
    await expect(createCollectionWithClip(input)).rejects.toThrow(
      "connection lost",
    );
  });
});

describe("getPickerData", () => {
  it("builds the picker from the ready clips, players and members", async () => {
    db.results.push(
      [{ id: COLLECTION }],
      [
        {
          id: CLIP,
          gameId: GAME,
          gameTitle: "Heimspiel",
          gameOpponent: null,
          tagType: "goal",
          startS: 30,
          visibility: "single",
          playerIds: [PLAYER],
        },
      ],
      [{ id: PLAYER, name: "Anna", jerseyNumber: 7 }],
      [{ clipId: CLIP }],
    );
    const picker = await getPickerData(COLLECTION);
    expect(picker?.clips).toEqual([
      {
        id: CLIP,
        title: "Tor",
        subtitle: "Heimspiel - 0:30",
        gameId: GAME,
        tagType: "goal",
        playerIds: [PLAYER],
        isSingle: true,
        inCollection: true,
      },
    ]);
    expect(picker?.players).toEqual([{ value: PLAYER, label: "7 Anna" }]);
  });

  it("is null for an unknown collection", async () => {
    db.results.push([]);
    expect(await getPickerData(COLLECTION)).toBeNull();
    expect(db.client.select).toHaveBeenCalledOnce();
  });
});
