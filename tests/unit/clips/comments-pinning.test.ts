import { describe, expect, it } from "vitest";

import {
  latestCoachCommentByClip,
  pinCoachComments,
} from "@/features/clips/comments/pinning";

function c(id: string, isCoach = false, clipId = "clip-1") {
  return { id, clipId, isCoach };
}

describe("pinCoachComments", () => {
  it("puts coach comments first, newest on top, then the rest oldest first", () => {
    const ordered = pinCoachComments([
      c("v1"),
      c("k1", true),
      c("v2"),
      c("k2", true),
      c("v3"),
    ]);
    expect(ordered.map((comment) => comment.id)).toEqual([
      "k2",
      "k1",
      "v1",
      "v2",
      "v3",
    ]);
  });

  it("keeps a thread without coach comments as it is", () => {
    const ordered = pinCoachComments([c("v1"), c("v2")]);
    expect(ordered.map((comment) => comment.id)).toEqual(["v1", "v2"]);
  });

  it("returns a new array and leaves the input untouched", () => {
    const input = [c("v1"), c("k1", true)];
    const ordered = pinCoachComments(input);
    expect(ordered).not.toBe(input);
    expect(input.map((comment) => comment.id)).toEqual(["v1", "k1"]);
  });

  it("handles an empty thread", () => {
    expect(pinCoachComments([])).toEqual([]);
  });
});

describe("latestCoachCommentByClip", () => {
  it("keeps each clip's most recent coach comment and skips the rest", () => {
    const latest = latestCoachCommentByClip([
      c("k1", true, "a"),
      c("v1", false, "a"),
      c("k2", true, "a"),
      c("k3", true, "b"),
      c("v2", false, "c"),
    ]);
    expect(latest.get("a")?.id).toBe("k2");
    expect(latest.get("b")?.id).toBe("k3");
    expect(latest.has("c")).toBe(false);
  });
});
