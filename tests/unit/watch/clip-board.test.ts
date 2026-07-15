import { describe, expect, it } from "vitest";

import {
  canEnqueueClip,
  hasInFlightClips,
  isInFlightClip,
  latestClipByTag,
  type ClipView,
} from "@/components/watch";

const clip = (
  id: string,
  tagId: string,
  status: ClipView["status"],
): ClipView => ({ id, tagId, status });

describe("isInFlightClip", () => {
  it("is true only for pending and processing", () => {
    expect(isInFlightClip("pending")).toBe(true);
    expect(isInFlightClip("processing")).toBe(true);
    expect(isInFlightClip("ready")).toBe(false);
    expect(isInFlightClip("failed")).toBe(false);
  });
});

describe("latestClipByTag", () => {
  it("keeps the newest clip per tag from a newest-first list", () => {
    // A tag re-cut after a failure: the fresh attempt leads the list.
    const byTag = latestClipByTag([
      clip("c3", "t1", "processing"),
      clip("c2", "t1", "failed"),
      clip("c1", "t2", "ready"),
    ]);

    expect(byTag.get("t1")).toEqual(clip("c3", "t1", "processing"));
    expect(byTag.get("t2")).toEqual(clip("c1", "t2", "ready"));
  });

  it("is an empty map for no clips", () => {
    expect(latestClipByTag([]).size).toBe(0);
  });
});

describe("hasInFlightClips", () => {
  it("is true when any tag's current clip is still cutting", () => {
    const byTag = latestClipByTag([
      clip("c1", "t1", "ready"),
      clip("c2", "t2", "pending"),
    ]);
    expect(hasInFlightClips(byTag)).toBe(true);
  });

  it("is false once every clip is terminal", () => {
    const byTag = latestClipByTag([
      clip("c1", "t1", "ready"),
      clip("c2", "t2", "failed"),
    ]);
    expect(hasInFlightClips(byTag)).toBe(false);
  });
});

describe("canEnqueueClip", () => {
  it("allows a cut for a tag with no clip or only a failed one", () => {
    expect(canEnqueueClip(undefined)).toBe(true);
    expect(canEnqueueClip(clip("c1", "t1", "failed"))).toBe(true);
  });

  it("blocks a cut while a live clip already covers the tag", () => {
    expect(canEnqueueClip(clip("c1", "t1", "pending"))).toBe(false);
    expect(canEnqueueClip(clip("c1", "t1", "processing"))).toBe(false);
    expect(canEnqueueClip(clip("c1", "t1", "ready"))).toBe(false);
  });
});
