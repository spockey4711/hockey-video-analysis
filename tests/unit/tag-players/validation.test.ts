import { describe, expect, it } from "vitest";

import { parseTagPlayersInput } from "@/features/tag-players/validation";

const playerA = "11111111-1111-4111-8111-111111111111";
const playerB = "22222222-2222-4222-8222-222222222222";

function base(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { visibility: "team", playerIds: [playerA], ...overrides };
}

describe("parseTagPlayersInput", () => {
  it("accepts a well-formed team body", () => {
    const result = parseTagPlayersInput(base());
    expect(result).toEqual({
      ok: true,
      value: { visibility: "team", playerIds: [playerA] },
    });
  });

  it("accepts a team body with no players", () => {
    const result = parseTagPlayersInput(base({ playerIds: [] }));
    expect(result).toEqual({
      ok: true,
      value: { visibility: "team", playerIds: [] },
    });
  });

  it("accepts a single body that names a player", () => {
    const result = parseTagPlayersInput(
      base({ visibility: "single", playerIds: [playerA, playerB] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.playerIds).toEqual([playerA, playerB]);
  });

  it("collapses duplicate player ids", () => {
    const result = parseTagPlayersInput(
      base({ playerIds: [playerA, playerA, playerB] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.playerIds).toEqual([playerA, playerB]);
  });

  it("rejects a non-object body", () => {
    expect(parseTagPlayersInput(null).ok).toBe(false);
    expect(parseTagPlayersInput("nope").ok).toBe(false);
  });

  it("rejects an unknown visibility", () => {
    expect(parseTagPlayersInput(base({ visibility: "public" })).ok).toBe(false);
    expect(parseTagPlayersInput(base({ visibility: undefined })).ok).toBe(
      false,
    );
  });

  it("rejects playerIds that are not an array", () => {
    expect(parseTagPlayersInput(base({ playerIds: playerA })).ok).toBe(false);
  });

  it("rejects a malformed player id", () => {
    expect(parseTagPlayersInput(base({ playerIds: ["not-a-uuid"] })).ok).toBe(
      false,
    );
    expect(parseTagPlayersInput(base({ playerIds: [42] })).ok).toBe(false);
  });

  it("rejects a single tag with no players", () => {
    const result = parseTagPlayersInput(
      base({ visibility: "single", playerIds: [] }),
    );
    expect(result.ok).toBe(false);
  });
});
