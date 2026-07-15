import { describe, expect, it } from "vitest";

import { parseTagInput } from "@/features/tagging/validation";

const gameId = "11111111-1111-4111-8111-111111111111";

function base(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { gameId, type: "goal", startS: 90, ...overrides };
}

describe("parseTagInput", () => {
  it("accepts a well-formed body and defaults an absent end to null", () => {
    const result = parseTagInput(base());
    expect(result).toEqual({
      ok: true,
      value: { gameId, type: "goal", startS: 90, endS: null },
    });
  });

  it("accepts an explicit end greater than the start", () => {
    const result = parseTagInput(base({ endS: 120 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.endS).toBe(120);
  });

  it("rejects a non-object body", () => {
    expect(parseTagInput(null).ok).toBe(false);
    expect(parseTagInput("nope").ok).toBe(false);
  });

  it("rejects a malformed game id", () => {
    expect(parseTagInput(base({ gameId: "not-a-uuid" })).ok).toBe(false);
  });

  it("rejects an unknown tag type", () => {
    expect(parseTagInput(base({ type: "penalty" })).ok).toBe(false);
  });

  it("rejects a negative or non-numeric start", () => {
    expect(parseTagInput(base({ startS: -1 })).ok).toBe(false);
    expect(parseTagInput(base({ startS: "90" })).ok).toBe(false);
  });

  it("rejects an end that is not after the start", () => {
    expect(parseTagInput(base({ endS: 90 })).ok).toBe(false);
    expect(parseTagInput(base({ endS: 10 })).ok).toBe(false);
  });
});
