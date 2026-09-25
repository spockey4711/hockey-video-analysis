import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the drizzle chains: every step returns the chain, and awaiting
// it yields the next queued result, so the test pins what the query does with
// its rows without a database.
const db = vi.hoisted(() => {
  const results: unknown[][] = [];
  const chain = () => {
    const step: Record<string, unknown> = {};
    for (const method of ["from", "innerJoin", "where", "orderBy", "limit"]) {
      step[method] = () => step;
    }
    step.then = (
      resolve: (rows: unknown[]) => unknown,
      reject: (cause: unknown) => unknown,
    ) => Promise.resolve(results.shift() ?? []).then(resolve, reject);
    return step;
  };
  return { results, client: { select: vi.fn(chain) } };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import { listEditorEntries } from "@/features/clip-editor/queries";
import { EMPTY_EDIT } from "@/features/clip-edits";

const COLLECTION = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";
const edit = { ...EMPTY_EDIT, trim: { startS: 101, endS: 110 } };

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "clip-1",
    status: "ready",
    outputPath: "clips/clip-1.mp4",
    cutStartS: 99,
    tagId: "tag-1",
    tagType: "goal",
    startS: 100,
    endS: 112,
    visibility: "team",
    gameTitle: "HTHC",
    gameOpponent: null,
    gameDurationS: 3600,
    edit,
    version: 2,
    ...overrides,
  };
}

beforeEach(() => {
  db.results.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listEditorEntries", () => {
  it("returns each clip with its window, edit and player flag", async () => {
    db.results.push([row(), row({ id: "clip-2", visibility: "single" })]);
    const [first, second] = await listEditorEntries(COLLECTION);
    expect(first).toEqual({
      id: "clip-1",
      status: "ready",
      outputPath: "clips/clip-1.mp4",
      cutStartS: 99,
      tagId: "tag-1",
      tagType: "goal",
      startS: 100,
      window: { startS: 100, endS: 112 },
      isSingle: false,
      gameTitle: "HTHC",
      gameOpponent: null,
      gameDurationS: 3600,
      edit,
      version: 2,
    });
    expect(second.isSingle).toBe(true);
  });

  it("falls back to the type's default window for a tag without an end", async () => {
    db.results.push([row({ endS: null })]);
    const [entry] = await listEditorEntries(COLLECTION);
    expect(entry.window.startS).toBe(100);
    expect(entry.window.endS).toBeGreaterThan(100);
  });

  it("reads a stored edit that no longer parses as none", async () => {
    db.results.push([row({ edit: { v: 99 } })]);
    const [entry] = await listEditorEntries(COLLECTION);
    expect(entry.edit).toBeNull();
    expect(console.error).toHaveBeenCalledOnce();
  });
});
