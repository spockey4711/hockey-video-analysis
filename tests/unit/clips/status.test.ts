import { describe, expect, it } from "vitest";

import {
  CLIP_STATUSES,
  isActiveClipStatus,
  isClipStatus,
} from "@/features/clips/status";

describe("isClipStatus", () => {
  it("accepts every enum value and rejects anything else", () => {
    for (const status of CLIP_STATUSES) {
      expect(isClipStatus(status)).toBe(true);
    }
    expect(isClipStatus("queued")).toBe(false);
    expect(isClipStatus("")).toBe(false);
    expect(isClipStatus(undefined)).toBe(false);
  });
});

describe("isActiveClipStatus", () => {
  it("treats pending, processing and ready as live jobs", () => {
    expect(isActiveClipStatus("pending")).toBe(true);
    expect(isActiveClipStatus("processing")).toBe(true);
    expect(isActiveClipStatus("ready")).toBe(true);
  });

  it("treats only failed as retryable (not live)", () => {
    expect(isActiveClipStatus("failed")).toBe(false);
  });
});
