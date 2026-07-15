import { describe, expect, it } from "vitest";

import { parseTagEditInput } from "@/features/tagging/edit/validation";

function base(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { type: "goal", startS: 90, endS: 105, ...overrides };
}

describe("parseTagEditInput", () => {
  it("accepts a well-formed edit with an explicit window", () => {
    const result = parseTagEditInput(base());
    expect(result).toEqual({
      ok: true,
      value: { type: "goal", startS: 90, endS: 105 },
    });
  });

  it("accepts a null end as the type's default window", () => {
    const result = parseTagEditInput(base({ endS: null }));
    expect(result).toEqual({
      ok: true,
      value: { type: "goal", startS: 90, endS: null },
    });
  });

  it("treats a missing end as a null default window", () => {
    const result = parseTagEditInput({ type: "goal", startS: 90 });
    expect(result).toEqual({
      ok: true,
      value: { type: "goal", startS: 90, endS: null },
    });
  });

  it("accepts a start of zero", () => {
    const result = parseTagEditInput(base({ startS: 0, endS: 5 }));
    expect(result.ok).toBe(true);
  });

  it("rejects a non-object body", () => {
    expect(parseTagEditInput(null).ok).toBe(false);
    expect(parseTagEditInput("nope").ok).toBe(false);
  });

  it("rejects an unknown tag type", () => {
    const result = parseTagEditInput(base({ type: "unknown" }));
    expect(result).toEqual({
      ok: false,
      error: "type must be a known tag type",
    });
  });

  it("rejects a negative start", () => {
    const result = parseTagEditInput(base({ startS: -1 }));
    expect(result.ok).toBe(false);
  });

  it("rejects a non-finite start", () => {
    const result = parseTagEditInput(
      base({ startS: Number.POSITIVE_INFINITY }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an end that is not greater than the start", () => {
    const result = parseTagEditInput(base({ startS: 90, endS: 90 }));
    expect(result).toEqual({
      ok: false,
      error: "endS must be greater than startS",
    });
  });

  it("rejects a non-numeric end", () => {
    const result = parseTagEditInput(base({ endS: "105" }));
    expect(result.ok).toBe(false);
  });
});
