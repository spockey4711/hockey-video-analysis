import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal stand-in for the drizzle select chain, so the test pins the query
// shape (and the no-ids short cut) without a database.
const db = vi.hoisted(() => {
  const orderBy = vi.fn();
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  return {
    orderBy,
    where,
    client: { select: vi.fn(() => ({ from })) },
  };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import { listCommentsForClips } from "@/features/clips/comments";

const CLIP_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const CLIP_B = "3f2504e0-4f89-41d3-9a0c-0305e82c3302";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCommentsForClips", () => {
  it("answers an empty list without querying when there are no clips", async () => {
    await expect(listCommentsForClips([])).resolves.toEqual([]);
    expect(db.client.select).not.toHaveBeenCalled();
  });

  it("reads the comments of all given clips in one ordered query", async () => {
    const rows = [
      {
        id: "c1",
        clipId: CLIP_A,
        author: "Alex",
        body: "Gut gelaufen.",
        createdAt: new Date("2026-09-20T10:00:00Z"),
      },
    ];
    db.orderBy.mockResolvedValue(rows);

    await expect(listCommentsForClips([CLIP_A, CLIP_B])).resolves.toBe(rows);
    expect(db.client.select).toHaveBeenCalledTimes(1);
    expect(db.where).toHaveBeenCalledTimes(1);
    expect(db.orderBy).toHaveBeenCalledTimes(1);
  });
});
