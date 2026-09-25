import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal stand-in for the drizzle chains the queries use, so the tests pin
// what is written (and the token retry) without a database.
const db = vi.hoisted(() => {
  const insertReturning = vi.fn();
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const updateReturning = vi.fn();
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  return {
    insertReturning,
    insertValues,
    updateReturning,
    updateSet,
    client: {
      insert: vi.fn(() => ({ values: insertValues })),
      update: vi.fn(() => ({ set: updateSet })),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import { createPlayer, updatePlayer } from "@/features/players/setup/queries";

const PLAYER_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const HEX_64 = /^[0-9a-f]{64}$/;

function uniqueViolation(): Error {
  return Object.assign(new Error("duplicate key"), { code: "23505" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPlayer", () => {
  it("inserts the player with a fresh 256-bit share token", async () => {
    db.insertReturning.mockResolvedValue([{ id: PLAYER_ID }]);

    await expect(
      createPlayer({ name: "Alex Muster", jerseyNumber: 7 }),
    ).resolves.toEqual({ id: PLAYER_ID });

    expect(db.insertValues).toHaveBeenCalledWith({
      name: "Alex Muster",
      jerseyNumber: 7,
      shareToken: expect.stringMatching(HEX_64),
    });
  });

  it("retries with a new token when the token collides", async () => {
    db.insertReturning
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce([{ id: PLAYER_ID }]);

    await expect(
      createPlayer({ name: "Alex", jerseyNumber: null }),
    ).resolves.toEqual({ id: PLAYER_ID });

    const tokens = db.insertValues.mock.calls.map(
      (call) => (call as unknown as [{ shareToken: string }])[0].shareToken,
    );
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it("gives up after repeated collisions", async () => {
    db.insertReturning.mockRejectedValue(uniqueViolation());

    await expect(
      createPlayer({ name: "Alex", jerseyNumber: null }),
    ).rejects.toMatchObject({ code: "23505" });
    expect(db.insertValues).toHaveBeenCalledTimes(3);
  });

  it("does not retry other failures", async () => {
    db.insertReturning.mockRejectedValue(new Error("db down"));

    await expect(
      createPlayer({ name: "Alex", jerseyNumber: null }),
    ).rejects.toThrow("db down");
    expect(db.insertValues).toHaveBeenCalledTimes(1);
  });
});

describe("updatePlayer", () => {
  it("writes only the name and number, never the share token", async () => {
    db.updateReturning.mockResolvedValue([{ id: PLAYER_ID }]);

    await expect(
      updatePlayer(PLAYER_ID, { name: "Kim", jerseyNumber: null }),
    ).resolves.toBe(true);
    expect(db.updateSet).toHaveBeenCalledWith({
      name: "Kim",
      jerseyNumber: null,
    });
  });

  it("reports a missing player", async () => {
    db.updateReturning.mockResolvedValue([]);

    await expect(
      updatePlayer(PLAYER_ID, { name: "Kim", jerseyNumber: 3 }),
    ).resolves.toBe(false);
  });
});
