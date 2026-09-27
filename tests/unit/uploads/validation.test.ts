import { describe, expect, it } from "vitest";

import { MAX_CLIP_UPLOAD_BYTES } from "@/features/uploads/limits";
import {
  parseByteCount,
  parseClipFileHandoff,
  parseUploadCreation,
} from "@/features/uploads/validation";

const CLIP = "5d9c1f0e-2b7a-4c3d-9e8f-0a1b2c3d4e5f";
const UPLOAD = "8a1f2e3d-4c5b-4a69-8778-695a4b3c2d1e";

describe("parseUploadCreation", () => {
  it("accepts a clip upload and lower-cases its target", () => {
    expect(
      parseUploadCreation({
        purpose: "clip",
        targetId: CLIP.toUpperCase(),
        sizeBytes: 1_234_567,
      }),
    ).toEqual({
      ok: true,
      value: { purpose: "clip", clipId: CLIP, sizeBytes: 1_234_567 },
    });
  });

  it.each([
    ["not an object", []],
    ["another purpose", { purpose: "chapter", targetId: CLIP, sizeBytes: 1 }],
    ["a bad target", { purpose: "clip", targetId: "../x", sizeBytes: 1 }],
    ["an empty file", { purpose: "clip", targetId: CLIP, sizeBytes: 0 }],
    ["a fraction", { purpose: "clip", targetId: CLIP, sizeBytes: 1.5 }],
    ["a string size", { purpose: "clip", targetId: CLIP, sizeBytes: "9" }],
  ])("refuses %s", (_, raw) => {
    const parsed = parseUploadCreation(raw);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok || parsed.tooLarge).toBeFalsy();
  });

  it("flags a size over the cap as too large", () => {
    const parsed = parseUploadCreation({
      purpose: "clip",
      targetId: CLIP,
      sizeBytes: MAX_CLIP_UPLOAD_BYTES + 1,
    });
    expect(parsed).toMatchObject({ ok: false, tooLarge: true });
    expect(
      parseUploadCreation({
        purpose: "clip",
        targetId: CLIP,
        sizeBytes: MAX_CLIP_UPLOAD_BYTES,
      }).ok,
    ).toBe(true);
  });
});

describe("parseByteCount", () => {
  it("reads a whole number of bytes", () => {
    expect(parseByteCount("0")).toBe(0);
    expect(parseByteCount(" 33554432 ")).toBe(33_554_432);
  });

  it.each([null, "", "-1", "1.5", "01", "1e3", "12abc", "99999999999999999"])(
    "refuses %s",
    (raw) => {
      expect(parseByteCount(raw)).toBeNull();
    },
  );
});

describe("parseClipFileHandoff", () => {
  it("accepts an upload id, tag version and file start", () => {
    expect(
      parseClipFileHandoff({
        uploadId: UPLOAD,
        tagVersion: 3,
        cutStartS: 61.2,
      }),
    ).toEqual({
      ok: true,
      value: { uploadId: UPLOAD, tagVersion: 3, cutStartS: 61.2 },
    });
  });

  it.each([
    ["no upload id", { tagVersion: 3, cutStartS: 1 }],
    ["version 0", { uploadId: UPLOAD, tagVersion: 0, cutStartS: 1 }],
    ["a huge version", { uploadId: UPLOAD, tagVersion: 2 ** 31, cutStartS: 1 }],
    ["a negative start", { uploadId: UPLOAD, tagVersion: 1, cutStartS: -1 }],
    ["no start", { uploadId: UPLOAD, tagVersion: 1 }],
    [
      "an infinite start",
      { uploadId: UPLOAD, tagVersion: 1, cutStartS: 1e999 },
    ],
  ])("refuses %s", (_, raw) => {
    expect(parseClipFileHandoff(raw).ok).toBe(false);
  });
});
