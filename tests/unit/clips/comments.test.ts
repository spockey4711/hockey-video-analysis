import { describe, expect, it } from "vitest";

import {
  AUTHOR_MAX_LENGTH,
  BODY_MAX_LENGTH,
  parseCommentInput,
} from "@/features/clips/comments";

describe("parseCommentInput", () => {
  it("accepts a well-formed comment", () => {
    expect(parseCommentInput({ author: "Coach K", body: "Nice run." })).toEqual(
      {
        ok: true,
        value: { author: "Coach K", body: "Nice run." },
      },
    );
  });

  it("trims leading and trailing whitespace off both fields", () => {
    expect(
      parseCommentInput({ author: "  Ada  ", body: "\n keep going \t" }),
    ).toEqual({ ok: true, value: { author: "Ada", body: "keep going" } });
  });

  it("ignores fields a client might smuggle in", () => {
    const result = parseCommentInput({
      author: "Ada",
      body: "hi",
      id: "spoofed",
      createdAt: "2000-01-01",
      clipId: "spoofed",
    });
    expect(result).toEqual({ ok: true, value: { author: "Ada", body: "hi" } });
  });

  it("rejects a non-object body", () => {
    expect(parseCommentInput(null).ok).toBe(false);
    expect(parseCommentInput("nope").ok).toBe(false);
    expect(parseCommentInput(42).ok).toBe(false);
  });

  it("rejects missing or non-string fields", () => {
    expect(parseCommentInput({ body: "hi" }).ok).toBe(false);
    expect(parseCommentInput({ author: "Ada" }).ok).toBe(false);
    expect(parseCommentInput({ author: 1, body: "hi" }).ok).toBe(false);
    expect(parseCommentInput({ author: "Ada", body: 1 }).ok).toBe(false);
  });

  it("rejects fields that are empty once trimmed", () => {
    expect(parseCommentInput({ author: "   ", body: "hi" }).ok).toBe(false);
    expect(parseCommentInput({ author: "Ada", body: "  \n " }).ok).toBe(false);
  });

  it("rejects fields past their length limit", () => {
    expect(
      parseCommentInput({
        author: "a".repeat(AUTHOR_MAX_LENGTH + 1),
        body: "hi",
      }).ok,
    ).toBe(false);
    expect(
      parseCommentInput({
        author: "Ada",
        body: "b".repeat(BODY_MAX_LENGTH + 1),
      }).ok,
    ).toBe(false);
  });

  it("accepts fields exactly at their length limit", () => {
    const result = parseCommentInput({
      author: "a".repeat(AUTHOR_MAX_LENGTH),
      body: "b".repeat(BODY_MAX_LENGTH),
    });
    expect(result.ok).toBe(true);
  });
});
