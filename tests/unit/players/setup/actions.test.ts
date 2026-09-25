import { beforeEach, describe, expect, it, vi } from "vitest";

// The actions are exercised against mocked auth and queries: the DB and the
// session are boundaries, and what matters here is the order of the checks and
// that nothing is written unless the coach and the input are valid.
const auth = vi.hoisted(() => ({ getCurrentCoach: vi.fn() }));
const queries = vi.hoisted(() => ({
  createPlayer: vi.fn(),
  updatePlayer: vi.fn(),
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/features/players/setup/queries", () => queries);

import {
  createPlayerAction,
  updatePlayerAction,
} from "@/features/players/setup/actions";
import { playerSetupContent } from "@/features/players/setup/content";
import { playerFormInitialState } from "@/features/players/setup/state";

const { errors } = playerSetupContent;
const COACH = { id: "coach-1", email: "coach@example.test", name: "Coach" };
const PLAYER_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.getCurrentCoach.mockResolvedValue(COACH);
  queries.createPlayer.mockResolvedValue({ id: PLAYER_ID });
  queries.updatePlayer.mockResolvedValue(true);
});

describe("createPlayerAction", () => {
  it("creates the validated player", async () => {
    const result = await createPlayerAction(
      playerFormInitialState,
      form({ name: " Alex Muster ", jerseyNumber: "7" }),
    );

    expect(result).toEqual({ status: "success" });
    expect(queries.createPlayer).toHaveBeenCalledWith({
      name: "Alex Muster",
      jerseyNumber: 7,
    });
  });

  it("refuses a caller without a coach session", async () => {
    auth.getCurrentCoach.mockResolvedValue(null);

    const result = await createPlayerAction(
      playerFormInitialState,
      form({ name: "Alex", jerseyNumber: "" }),
    );

    expect(result).toEqual({ status: "error", error: errors.unauthorized });
    expect(queries.createPlayer).not.toHaveBeenCalled();
  });

  it("returns field errors and writes nothing for invalid input", async () => {
    const result = await createPlayerAction(playerFormInitialState, form({}));

    expect(result).toEqual({
      status: "error",
      fieldErrors: { name: errors.nameRequired },
    });
    expect(queries.createPlayer).not.toHaveBeenCalled();
  });

  it("reports an unexpected failure without leaking it", async () => {
    queries.createPlayer.mockRejectedValue(new Error("db down"));

    const result = await createPlayerAction(
      playerFormInitialState,
      form({ name: "Alex", jerseyNumber: "" }),
    );

    expect(result).toEqual({ status: "error", error: errors.unexpected });
  });
});

describe("updatePlayerAction", () => {
  it("updates the player's name and number", async () => {
    const result = await updatePlayerAction(
      playerFormInitialState,
      form({ playerId: PLAYER_ID, name: "Kim Beispiel", jerseyNumber: "" }),
    );

    expect(result).toEqual({ status: "success" });
    expect(queries.updatePlayer).toHaveBeenCalledWith(PLAYER_ID, {
      name: "Kim Beispiel",
      jerseyNumber: null,
    });
  });

  it("refuses a caller without a coach session", async () => {
    auth.getCurrentCoach.mockResolvedValue(null);

    const result = await updatePlayerAction(
      playerFormInitialState,
      form({ playerId: PLAYER_ID, name: "Kim", jerseyNumber: "" }),
    );

    expect(result).toEqual({ status: "error", error: errors.unauthorized });
    expect(queries.updatePlayer).not.toHaveBeenCalled();
  });

  it("rejects a malformed player id before any query", async () => {
    const result = await updatePlayerAction(
      playerFormInitialState,
      form({ playerId: "not-a-uuid", name: "Kim", jerseyNumber: "" }),
    );

    expect(result).toEqual({ status: "error", error: errors.invalidId });
    expect(queries.updatePlayer).not.toHaveBeenCalled();
  });

  it("returns field errors and writes nothing for invalid input", async () => {
    const result = await updatePlayerAction(
      playerFormInitialState,
      form({ playerId: PLAYER_ID, name: "Kim", jerseyNumber: "100" }),
    );

    expect(result).toEqual({
      status: "error",
      fieldErrors: { jerseyNumber: errors.jerseyInvalid },
    });
    expect(queries.updatePlayer).not.toHaveBeenCalled();
  });

  it("reports a player that no longer exists", async () => {
    queries.updatePlayer.mockResolvedValue(false);

    const result = await updatePlayerAction(
      playerFormInitialState,
      form({ playerId: PLAYER_ID, name: "Kim", jerseyNumber: "" }),
    );

    expect(result).toEqual({ status: "error", error: errors.notFound });
  });
});
