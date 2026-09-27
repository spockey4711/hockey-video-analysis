import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createStagingFile,
  hasMp4Signature,
  listStagedUploads,
  removeStagingFile,
  stagedUploadId,
  stagingFilePath,
  stagingRootFromEnv,
  writeChunk,
} from "@/features/uploads/staging";

const UPLOAD = "8a1f2e3d-4c5b-4a69-8778-695a4b3c2d1e";

function body(...parts: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(new TextEncoder().encode(part));
      }
      controller.close();
    },
  });
}

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "upload-staging-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("staging paths", () => {
  it("names a staged file only by its upload id", () => {
    expect(stagingFilePath("/staging", UPLOAD.toUpperCase())).toBe(
      path.join("/staging", `${UPLOAD}.part`),
    );
  });

  it.each(["../clips/x", "x/../../etc", "", "a".repeat(36)])(
    "refuses %j as an upload id",
    (id) => {
      expect(() => stagingFilePath("/staging", id)).toThrow(RangeError);
    },
  );

  it("tells staged files from any other name", () => {
    expect(stagedUploadId(`${UPLOAD}.part`)).toBe(UPLOAD);
    expect(stagedUploadId(`${UPLOAD}.mp4`)).toBeNull();
    expect(stagedUploadId("notes.part")).toBeNull();
  });

  it("reads the root from the environment", () => {
    expect(stagingRootFromEnv({})).toBeNull();
    expect(stagingRootFromEnv({ UPLOAD_STAGING_ROOT: "  " })).toBeNull();
    expect(stagingRootFromEnv({ UPLOAD_STAGING_ROOT: "/srv/uploads/" })).toBe(
      "/srv/uploads",
    );
  });
});

describe("staged files", () => {
  it("creates, lists and removes an upload's file", async () => {
    await createStagingFile(path.join(root, "new"), UPLOAD);
    await writeFile(path.join(root, "new", "stray.txt"), "keep");
    await expect(listStagedUploads(path.join(root, "new"))).resolves.toEqual([
      UPLOAD,
    ]);
    await removeStagingFile(path.join(root, "new"), UPLOAD);
    await removeStagingFile(path.join(root, "new"), UPLOAD);
    await expect(listStagedUploads(path.join(root, "new"))).resolves.toEqual(
      [],
    );
  });

  it("lists nothing for a directory that does not exist yet", async () => {
    await expect(listStagedUploads(path.join(root, "none"))).resolves.toEqual(
      [],
    );
  });
});

describe("writeChunk", () => {
  it("writes each chunk at its offset", async () => {
    await createStagingFile(root, UPLOAD);
    const file = stagingFilePath(root, UPLOAD);
    await expect(writeChunk(file, 0, body("ab", "cd"), 4)).resolves.toEqual({
      written: 4,
      overflow: false,
      interrupted: false,
    });
    await writeChunk(file, 4, body("ef"), 2);
    // A retried chunk lands on the same bytes and does not grow the file.
    await writeChunk(file, 2, body("cd"), 2);
    await expect(readFile(file, "utf8")).resolves.toBe("abcdef");
  });

  it("drops what a body carries past its length", async () => {
    await createStagingFile(root, UPLOAD);
    const file = stagingFilePath(root, UPLOAD);
    await expect(writeChunk(file, 0, body("abc", "def"), 4)).resolves.toEqual({
      written: 4,
      overflow: true,
      interrupted: false,
    });
    await expect(readFile(file, "utf8")).resolves.toBe("abcd");
  });

  it("keeps and reports what landed before a body broke off", async () => {
    await createStagingFile(root, UPLOAD);
    const file = stagingFilePath(root, UPLOAD);
    let pulls = 0;
    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) controller.enqueue(new TextEncoder().encode("abc"));
        else controller.error(new Error("connection reset"));
      },
    });
    await expect(writeChunk(file, 0, broken, 10)).resolves.toEqual({
      written: 3,
      overflow: false,
      interrupted: true,
    });
    await expect(readFile(file, "utf8")).resolves.toBe("abc");
  });
});

describe("hasMp4Signature", () => {
  it("recognises an ftyp box at the start", () => {
    const head = Uint8Array.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]);
    expect(hasMp4Signature(head)).toBe(true);
    expect(hasMp4Signature(head.subarray(0, 7))).toBe(false);
    expect(hasMp4Signature(new TextEncoder().encode("<html><b"))).toBe(false);
  });
});
