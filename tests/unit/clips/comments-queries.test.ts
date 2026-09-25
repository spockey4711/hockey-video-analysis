import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal stand-in for the drizzle select and insert chains, so the test pins
// the query shape (and the no-ids short cut) without a database.
const db = vi.hoisted(() => {
  const orderBy = vi.fn();
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const returning = vi.fn();
  const values = vi.fn(() => ({ returning }));
  return {
    orderBy,
    where,
    values,
    returning,
    client: {
      select: vi.fn(() => ({ from })),
      insert: vi.fn(() => ({ values })),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import {
  addCommentToClip,
  listCoachCommentsForClips,
  listCommentsForClips,
} from "@/features/clips/comments";

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
        isCoach: false,
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

describe("listCoachCommentsForClips", () => {
  it("answers an empty list without querying when there are no clips", async () => {
    await expect(listCoachCommentsForClips([])).resolves.toEqual([]);
    expect(db.client.select).not.toHaveBeenCalled();
  });

  it("reads the coach comments of all given clips in one ordered query", async () => {
    db.orderBy.mockResolvedValue([]);

    await expect(listCoachCommentsForClips([CLIP_A, CLIP_B])).resolves.toEqual(
      [],
    );
    expect(db.client.select).toHaveBeenCalledTimes(1);
    expect(db.where).toHaveBeenCalledTimes(1);
    expect(db.orderBy).toHaveBeenCalledTimes(1);
  });
});

describe("addCommentToClip", () => {
  it("stores the coach flag the route resolved, not one from the input", async () => {
    db.returning.mockResolvedValue([{ id: "c1" }]);
    const input = { author: "Alex", body: "Gut.", isCoach: true };

    await addCommentToClip(CLIP_A, input, { isCoach: false });
    expect(db.values).toHaveBeenLastCalledWith({
      clipId: CLIP_A,
      author: "Alex",
      body: "Gut.",
      isCoach: false,
    });

    await addCommentToClip(
      CLIP_A,
      { author: "Kim", body: "Top." },
      {
        isCoach: true,
      },
    );
    expect(db.values).toHaveBeenLastCalledWith({
      clipId: CLIP_A,
      author: "Kim",
      body: "Top.",
      isCoach: true,
    });
  });
});
