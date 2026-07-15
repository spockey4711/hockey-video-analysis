import { describe, expect, it } from "vitest";

import { isUuid, parseClipEnqueueInput } from "@/features/clips/validation";

const tagId = "22222222-2222-4222-8222-222222222222";

describe("parseClipEnqueueInput", () => {
  it("accepts a well-formed body", () => {
    expect(parseClipEnqueueInput({ tagId })).toEqual({
      ok: true,
      value: { tagId },
    });
  });

  it("ignores server-owned fields a client might smuggle in", () => {
    const result = parseClipEnqueueInput({
      tagId,
      status: "ready",
      outputPath: "/evil.mp4",
    });
    expect(result).toEqual({ ok: true, value: { tagId } });
  });

  it("rejects a non-object body", () => {
    expect(parseClipEnqueueInput(null).ok).toBe(false);
    expect(parseClipEnqueueInput("nope").ok).toBe(false);
  });

  it("rejects a missing or malformed tag id", () => {
    expect(parseClipEnqueueInput({}).ok).toBe(false);
    expect(parseClipEnqueueInput({ tagId: "not-a-uuid" }).ok).toBe(false);
    expect(parseClipEnqueueInput({ tagId: 42 }).ok).toBe(false);
  });
});

describe("isUuid", () => {
  it("accepts a canonical uuid and rejects everything else", () => {
    expect(isUuid(tagId)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});
