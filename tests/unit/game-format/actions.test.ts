import { beforeEach, describe, expect, it, vi } from "vitest";

// The actions run against mocked auth and queries: the DB is a boundary, and
// what matters here is that only valid input reaches it, in the right shape.
const queries = vi.hoisted(() => ({
  setTeamGameFormat: vi.fn(),
  updateGameFormat: vi.fn(),
}));

vi.mock("@/features/access", () => ({ requireCoach: vi.fn() }));
vi.mock("@/features/game-format/queries", () => queries);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  setTeamGameFormatAction,
  updateGameFormatAction,
} from "@/features/game-format/actions";
import { gameFormatContent } from "@/features/game-format/content";

const { problems, errors } = gameFormatContent;
const GAME_ID = "11111111-1111-4111-8111-111111111111";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  queries.setTeamGameFormat.mockResolvedValue(undefined);
  queries.updateGameFormat.mockResolvedValue(true);
});

describe("setTeamGameFormatAction", () => {
  it("stores a valid team default in seconds", async () => {
    const state = await setTeamGameFormatAction(
      {},
      form({ periodCount: "2", periodLengthMin: "20" }),
    );
    expect(state).toEqual({ success: true });
    expect(queries.setTeamGameFormat).toHaveBeenCalledWith({
      periodCount: 2,
      periodLengthS: 1200,
    });
  });

  it("returns field errors and stores nothing for bad input", async () => {
    const state = await setTeamGameFormatAction(
      {},
      form({ periodCount: "3", periodLengthMin: "0" }),
    );
    expect(state).toEqual({
      fieldErrors: {
        periodCount: problems.periodCount,
        periodLengthMin: problems.periodLengthMin,
      },
    });
    expect(queries.setTeamGameFormat).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    queries.setTeamGameFormat.mockRejectedValue(new Error("db down"));
    const state = await setTeamGameFormatAction(
      {},
      form({ periodCount: "4", periodLengthMin: "15" }),
    );
    expect(state).toEqual({ error: errors.unexpected });
  });
});

describe("updateGameFormatAction", () => {
  it("sets a game's own format", async () => {
    const state = await updateGameFormatAction(
      {},
      form({
        gameId: GAME_ID,
        formatChoice: "custom",
        periodCount: "4",
        periodLengthMin: "10",
      }),
    );
    expect(state).toEqual({ success: true });
    expect(queries.updateGameFormat).toHaveBeenCalledWith(GAME_ID, {
      periodCount: 4,
      periodLengthS: 600,
    });
  });

  it("puts a game back on the team default", async () => {
    await updateGameFormatAction(
      {},
      form({ gameId: GAME_ID, formatChoice: "team" }),
    );
    expect(queries.updateGameFormat).toHaveBeenCalledWith(GAME_ID, null);
  });

  it("rejects a malformed game id before the database", async () => {
    const state = await updateGameFormatAction(
      {},
      form({ gameId: "game-1", formatChoice: "team" }),
    );
    expect(state).toEqual({ error: errors.unexpected });
    expect(queries.updateGameFormat).not.toHaveBeenCalled();
  });

  it("says when the game is gone", async () => {
    queries.updateGameFormat.mockResolvedValue(false);
    const state = await updateGameFormatAction(
      {},
      form({ gameId: GAME_ID, formatChoice: "team" }),
    );
    expect(state).toEqual({ error: errors.gameGone });
  });
});
