import { describe, expect, it } from "vitest";

import {
  parseViewEvent,
  TOKEN_MAX_LENGTH,
  VIEW_EVENT_TYPES,
} from "@/features/share/views/events";

const clipId = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";

describe("parseViewEvent", () => {
  it.each(VIEW_EVENT_TYPES)("accepts a %s report", (type) => {
    expect(parseViewEvent({ token: "tok", clipId, type })).toEqual({
      ok: true,
      value: { token: "tok", clipId, type },
    });
  });

  it("keeps only the known fields", () => {
    const result = parseViewEvent({
      token: "tok",
      clipId,
      type: "click",
      day: "2000-01-01",
      viewerKey: "spoofed",
      collectionId: clipId,
    });
    expect(result).toEqual({
      ok: true,
      value: { token: "tok", clipId, type: "click" },
    });
  });

  it("ignores an event type it does not know instead of rejecting it", () => {
    expect(parseViewEvent({ token: "tok", clipId, type: "share" })).toEqual({
      ok: true,
      value: null,
    });
  });

  it("rejects a body that is not an object", () => {
    for (const raw of [null, "click", 42, [], undefined]) {
      expect(parseViewEvent(raw).ok).toBe(false);
    }
  });

  it("rejects a missing, empty or oversized token", () => {
    expect(parseViewEvent({ clipId, type: "click" }).ok).toBe(false);
    expect(parseViewEvent({ token: "", clipId, type: "click" }).ok).toBe(false);
    expect(parseViewEvent({ token: 1, clipId, type: "click" }).ok).toBe(false);
    expect(
      parseViewEvent({
        token: "t".repeat(TOKEN_MAX_LENGTH + 1),
        clipId,
        type: "click",
      }).ok,
    ).toBe(false);
  });

  it("rejects a clip id that is not a uuid", () => {
    expect(parseViewEvent({ token: "tok", type: "click" }).ok).toBe(false);
    expect(
      parseViewEvent({ token: "tok", clipId: "../1", type: "click" }).ok,
    ).toBe(false);
  });

  it("rejects a type that is not a string", () => {
    expect(parseViewEvent({ token: "tok", clipId }).ok).toBe(false);
    expect(parseViewEvent({ token: "tok", clipId, type: 1 }).ok).toBe(false);
  });
});
