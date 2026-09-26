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

import { EMPTY_EDIT } from "@/features/clip-edits";
import { listReadyClipsForCollection } from "@/features/share/collections/share-queries";

const COLLECTION = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "clip-1",
    tagType: "goal",
    startS: 100,
    playedOn: "2026-03-01",
    outputPath: "clips/clip-1.mp4",
    gameTitle: "HTHC",
    gameOpponent: null,
    teamNote: null,
    endS: 112,
    cutStartS: 99,
    edit: null,
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

describe("listReadyClipsForCollection", () => {
  it("carries each clip's timeline and edit for its playback plan", async () => {
    const edit = { ...EMPTY_EDIT, trim: { startS: 101, endS: 110 } };
    db.results.push([row({ edit })]);
    const [clip] = await listReadyClipsForCollection(COLLECTION);
    expect(clip).toEqual({
      id: "clip-1",
      tagType: "goal",
      startS: 100,
      playedOn: "2026-03-01",
      outputPath: "clips/clip-1.mp4",
      gameTitle: "HTHC",
      gameOpponent: null,
      teamNote: null,
      timeline: { cutStartS: 99, window: { startS: 100, endS: 112 } },
      edit,
    });
  });

  it("plays a clip whose stored edit no longer parses as the plain clip", async () => {
    db.results.push([row({ edit: { v: 1, trim: "broken" } })]);
    const [clip] = await listReadyClipsForCollection(COLLECTION);
    expect(clip.edit).toBeNull();
  });

  it("drops a ready clip without a file", async () => {
    db.results.push([row({ outputPath: null })]);
    expect(await listReadyClipsForCollection(COLLECTION)).toEqual([]);
  });
});
