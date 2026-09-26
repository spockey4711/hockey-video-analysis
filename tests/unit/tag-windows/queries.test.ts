import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the drizzle client that records what each write does, so the
// test pins which rows a save or a reset keeps without a database.
const db = vi.hoisted(() => {
  const calls: {
    deletes: { where: unknown }[];
    upserts: { values: unknown; set: unknown }[];
    stored: unknown[];
  } = { deletes: [], upserts: [], stored: [] };
  const writer = {
    delete: () => {
      const entry: { where: unknown } = { where: "all" };
      calls.deletes.push(entry);
      return {
        where: (condition: unknown) => {
          entry.where = condition;
          return Promise.resolve();
        },
        then: (resolve: () => unknown) => Promise.resolve().then(resolve),
      };
    },
    insert: () => ({
      values: (values: unknown) => ({
        onConflictDoUpdate: ({ set }: { set: unknown }) => {
          calls.upserts.push({ values, set });
          return Promise.resolve();
        },
      }),
    }),
  };
  const client = {
    ...writer,
    select: () => ({ from: () => Promise.resolve(calls.stored) }),
    transaction: async (fn: (tx: typeof writer) => Promise<void>) => fn(writer),
  };
  return { calls, client };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import {
  getTagWindows,
  resetTagWindows,
  setTagWindows,
} from "@/features/tag-windows/queries";
import { DEFAULT_TAG_WINDOWS, resolveTagWindows } from "@/lib/tag-types";

const dialect = new PgDialect();

beforeEach(() => {
  db.calls.deletes.length = 0;
  db.calls.upserts.length = 0;
  db.calls.stored = [];
});

describe("getTagWindows", () => {
  it("is the defaults while the team set nothing", async () => {
    expect(await getTagWindows()).toEqual(DEFAULT_TAG_WINDOWS);
  });

  it("puts the stored windows over the defaults", async () => {
    db.calls.stored = [{ type: "goal", preS: 15, postS: 5 }];
    expect(await getTagWindows()).toEqual({
      ...DEFAULT_TAG_WINDOWS,
      goal: { preS: 15, postS: 5 },
    });
  });
});

describe("setTagWindows", () => {
  it("stores only a changed window and removes every other row", async () => {
    await setTagWindows(
      resolveTagWindows([{ type: "goal", preS: 15, postS: 5 }]),
    );
    expect(db.calls.upserts).toEqual([
      {
        values: { type: "goal", preS: 15, postS: 5 },
        set: { preS: 15, postS: 5 },
      },
    ]);
    expect(db.calls.deletes).toHaveLength(1);
    const { sql, params } = dialect.sqlToQuery(
      db.calls.deletes[0]!.where as SQL,
    );
    expect(sql).toContain("not in");
    expect(params).toEqual(["goal"]);
  });

  it("removes every row when the windows are all back on their default", async () => {
    await setTagWindows(DEFAULT_TAG_WINDOWS);
    expect(db.calls.upserts).toEqual([]);
    expect(db.calls.deletes).toEqual([{ where: undefined }]);
  });
});

describe("resetTagWindows", () => {
  it("removes every row, so each type follows its default again", async () => {
    await resetTagWindows();
    expect(db.calls.deletes).toEqual([{ where: "all" }]);
    expect(db.calls.upserts).toEqual([]);
  });
});
