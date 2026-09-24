import { beforeEach, describe, expect, it, vi } from "vitest";

// The actions run against a mocked coach guard and mocked queries: the DB is a
// boundary, and what matters here is the order of the checks, what reaches the
// queries, and that only a successful accept or discard redirects to the list.
const access = vi.hoisted(() => ({ requireCoach: vi.fn() }));
const queries = vi.hoisted(() => ({
  acceptImportedGame: vi.fn(),
  discardImportedGame: vi.fn(),
  createGameWithSources: vi.fn(),
}));
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/features/access", () => access);
vi.mock("@/features/games/queries", () => queries);
vi.mock("next/navigation", () => navigation);

import {
  acceptImportedGameAction,
  discardImportedGameAction,
} from "@/features/games/actions";
import { gamesContent } from "@/features/games/content";

const { errors } = gamesContent;
const GAME_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function acceptForm(fields: Record<string, string> = {}): FormData {
  const data = new FormData();
  const values = {
    gameId: GAME_ID,
    title: "Heim vs. Rot-Weiss",
    opponent: "Rot-Weiss",
    playedOn: "2026-05-12",
    ...fields,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function discardForm(gameId = GAME_ID): FormData {
  const data = new FormData();
  data.set("gameId", gameId);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  access.requireCoach.mockResolvedValue({ id: "coach-1" });
  queries.acceptImportedGame.mockResolvedValue({ updated: true });
  queries.discardImportedGame.mockResolvedValue({ deleted: true });
});

describe("acceptImportedGameAction", () => {
  it("saves the review and redirects to the games list", async () => {
    await expect(acceptImportedGameAction({}, acceptForm())).rejects.toThrow(
      "NEXT_REDIRECT:/games",
    );
    expect(access.requireCoach).toHaveBeenCalledOnce();
    expect(queries.acceptImportedGame).toHaveBeenCalledWith(GAME_ID, {
      title: "Heim vs. Rot-Weiss",
      opponent: "Rot-Weiss",
      playedOn: "2026-05-12",
    });
  });

  it("asks for the date when the import had none, keeping the input", async () => {
    const result = await acceptImportedGameAction(
      {},
      acceptForm({ playedOn: "" }),
    );
    expect(result.fieldErrors).toEqual({ playedOn: errors.playedOnRequired });
    expect(result.values).toEqual({
      title: "Heim vs. Rot-Weiss",
      opponent: "Rot-Weiss",
      playedOn: "",
    });
    expect(queries.acceptImportedGame).not.toHaveBeenCalled();
  });

  it("rejects a malformed game id without touching the database", async () => {
    const result = await acceptImportedGameAction(
      {},
      acceptForm({ gameId: "not-a-uuid" }),
    );
    expect(result.error).toBe(errors.unexpected);
    expect(queries.acceptImportedGame).not.toHaveBeenCalled();
  });

  it("reports a game that was already accepted or discarded", async () => {
    queries.acceptImportedGame.mockResolvedValue({ updated: false });
    const result = await acceptImportedGameAction({}, acceptForm());
    expect(result.error).toBe(errors.reviewGone);
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("maps a database failure to the generic error", async () => {
    queries.acceptImportedGame.mockRejectedValue(new Error("db down"));
    const result = await acceptImportedGameAction({}, acceptForm());
    expect(result.error).toBe(errors.unexpected);
  });

  it("stops at the coach guard", async () => {
    access.requireCoach.mockRejectedValue(new Error("NEXT_REDIRECT:/login"));
    await expect(acceptImportedGameAction({}, acceptForm())).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
    expect(queries.acceptImportedGame).not.toHaveBeenCalled();
  });
});

describe("discardImportedGameAction", () => {
  it("deletes the game and redirects to the games list", async () => {
    await expect(discardImportedGameAction({}, discardForm())).rejects.toThrow(
      "NEXT_REDIRECT:/games",
    );
    expect(queries.discardImportedGame).toHaveBeenCalledWith(GAME_ID);
  });

  it("rejects a malformed game id without touching the database", async () => {
    const result = await discardImportedGameAction({}, discardForm("../1"));
    expect(result.error).toBe(errors.unexpected);
    expect(queries.discardImportedGame).not.toHaveBeenCalled();
  });

  it("refuses to discard a game that is no longer under review", async () => {
    queries.discardImportedGame.mockResolvedValue({ deleted: false });
    const result = await discardImportedGameAction({}, discardForm());
    expect(result.error).toBe(errors.reviewGone);
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("maps a database failure to the generic error", async () => {
    queries.discardImportedGame.mockRejectedValue(new Error("db down"));
    const result = await discardImportedGameAction({}, discardForm());
    expect(result.error).toBe(errors.unexpected);
  });

  it("stops at the coach guard", async () => {
    access.requireCoach.mockRejectedValue(new Error("NEXT_REDIRECT:/login"));
    await expect(discardImportedGameAction({}, discardForm())).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
    expect(queries.discardImportedGame).not.toHaveBeenCalled();
  });
});
