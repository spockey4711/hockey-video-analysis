import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the drizzle chains: every step returns the chain, and awaiting
// it yields the next queued result, so the test pins what each query does with
// its rows without a database.
const db = vi.hoisted(() => {
  const results: unknown[][] = [];
  const chain = () => {
    const step: Record<string, unknown> = {};
    for (const method of [
      "from",
      "innerJoin",
      "where",
      "limit",
      "set",
      "returning",
    ]) {
      step[method] = () => step;
    }
    step.then = (
      resolve: (rows: unknown[]) => unknown,
      reject: (cause: unknown) => unknown,
    ) => Promise.resolve(results.shift() ?? []).then(resolve, reject);
    return step;
  };
  return {
    results,
    client: { select: vi.fn(chain), update: vi.fn(chain) },
  };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import type { ClipEdit } from "@/features/clip-edits";
import { getEntryEdit, saveEntryEdit } from "@/features/clip-edits/queries";

const COLLECTION = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";
const CLIP = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const edit: ClipEdit = { v: 1, trim: null, slow: [], zoom: [], marks: [] };

function row(overrides: Record<string, unknown> = {}) {
  return {
    edit,
    version: 4,
    cutStartS: 98.7,
    clipStatus: "ready",
    tagType: "goal",
    startS: 100,
    endS: 112,
    ...overrides,
  };
}

beforeEach(() => {
  db.results.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("getEntryEdit", () => {
  it("returns the parsed edit, its version, the clip window and file start", async () => {
    db.results.push([row()]);

    await expect(getEntryEdit(COLLECTION, CLIP)).resolves.toEqual({
      edit,
      version: 4,
      window: { startS: 100, endS: 112 },
      cutStartS: 98.7,
      clipStatus: "ready",
    });
  });

  it("uses the tag type's default window when the tag has no end", async () => {
    db.results.push([row({ endS: null })]);

    // `goal` is configured with postS = 5.
    const entry = await getEntryEdit(COLLECTION, CLIP);
    expect(entry?.window).toEqual({ startS: 100, endS: 105 });
  });

  it("reads a stored edit that no longer parses as no edit", async () => {
    db.results.push([row({ edit: { v: 99 } })]);

    const entry = await getEntryEdit(COLLECTION, CLIP);
    expect(entry?.edit).toBeNull();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("returns null for a clip not in the collection", async () => {
    db.results.push([]);

    await expect(getEntryEdit(COLLECTION, CLIP)).resolves.toBeNull();
  });
});

describe("saveEntryEdit", () => {
  it("saves from the expected version and reports the next one", async () => {
    db.results.push([{ version: 5 }]);

    await expect(saveEntryEdit(COLLECTION, CLIP, edit, 4)).resolves.toEqual({
      status: "saved",
      version: 5,
    });
    expect(db.client.select).not.toHaveBeenCalled();
  });

  it("reports a conflict with the current version when the entry moved on", async () => {
    db.results.push([], [{ version: 7 }]);

    await expect(saveEntryEdit(COLLECTION, CLIP, edit, 4)).resolves.toEqual({
      status: "conflict",
      version: 7,
    });
  });

  it("reports a missing entry", async () => {
    db.results.push([], []);

    await expect(saveEntryEdit(COLLECTION, CLIP, null, 0)).resolves.toEqual({
      status: "missing",
    });
  });
});
