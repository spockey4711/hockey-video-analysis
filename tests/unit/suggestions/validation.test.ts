import { describe, expect, it } from "vitest";

import {
  isValidCandidateId,
  parseReviewInput,
} from "@/features/suggestions/validation";

describe("isValidCandidateId", () => {
  it("accepts a well-formed UUID in either case", () => {
    expect(isValidCandidateId("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(
      true,
    );
    expect(isValidCandidateId("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(
      true,
    );
  });

  it("rejects strings that are not a UUID", () => {
    expect(isValidCandidateId("")).toBe(false);
    expect(isValidCandidateId("not-a-uuid")).toBe(false);
    expect(isValidCandidateId("3f2504e0-4f89-41d3-9a0c-0305e82c330")).toBe(
      false,
    );
  });

  it("rejects non-string input a client might smuggle in", () => {
    expect(isValidCandidateId(undefined)).toBe(false);
    expect(isValidCandidateId(null)).toBe(false);
    expect(isValidCandidateId(42)).toBe(false);
  });
});

describe("parseReviewInput", () => {
  it("accepts a confirm decision", () => {
    expect(parseReviewInput({ decision: "confirm" })).toEqual({
      ok: true,
      value: { decision: "confirm" },
    });
  });

  it("accepts a reject decision", () => {
    expect(parseReviewInput({ decision: "reject" })).toEqual({
      ok: true,
      value: { decision: "reject" },
    });
  });

  it("rejects an unknown decision so it can never reach the database", () => {
    const result = parseReviewInput({ decision: "commit" });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing or non-string decision", () => {
    expect(parseReviewInput({}).ok).toBe(false);
    expect(parseReviewInput({ decision: 1 }).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseReviewInput(null).ok).toBe(false);
    expect(parseReviewInput("confirm").ok).toBe(false);
  });
});
