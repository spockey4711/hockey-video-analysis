import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectGoldenPayload } from "./golden";

// The Mac's upload routes (ADR 0013, Mac plan S5) against mocked queries and a
// real staging directory: the bearer-only session, the offset protocol, the
// size and type checks before a byte is kept, and the hand-off's answers. The
// bodies the Mac decodes are pinned as golden payloads in `contracts/api/`.
const auth = vi.hoisted(() => ({ getDeviceSession: vi.fn() }));
const queries = vi.hoisted(() => ({
  createClipUpload: vi.fn(),
  readUpload: vi.fn(),
  advanceUpload: vi.fn(),
  deleteUpload: vi.fn(),
  handOffClipFile: vi.fn(),
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/features/uploads/queries", () => queries);

import { POST as postClipFile } from "@/app/api/app/v1/clips/[id]/file/route";
import {
  DELETE as deleteUpload,
  HEAD as headUpload,
  PATCH as patchUpload,
} from "@/app/api/app/v1/uploads/[id]/route";
import { POST as postUpload } from "@/app/api/app/v1/uploads/route";
import { MIN_APP_VERSION } from "@/features/app-api/version";
import {
  MAX_CLIP_UPLOAD_BYTES,
  MAX_UPLOAD_CHUNK_BYTES,
} from "@/features/uploads/limits";
import { createStagingFile, stagingFilePath } from "@/features/uploads/staging";

const COACH = "0f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0f";
const CLIP = "3e4f5a6b-7c8d-4e9f-a0b1-2c3d4e5f6a7b";
const UPLOAD = "8a1f2e3d-4c5b-4a69-8778-695a4b3c2d1e";
const TAG = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const EXPIRES = new Date("2026-09-28T08:00:00.000Z");

/** The first bytes of an MP4 file: a `ftyp` box. */
const MP4_HEAD = new Uint8Array([
  0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);

function upload(receivedBytes: number, sizeBytes = 24) {
  return {
    id: UPLOAD,
    sizeBytes,
    receivedBytes,
    status: "receiving" as const,
    expiresAt: EXPIRES,
  };
}

function request(
  method: string,
  urlPath: string,
  init: { body?: BodyInit; headers?: Record<string, string> } = {},
) {
  const headers = new Headers({
    authorization: `Bearer ${"f".repeat(64)}`,
    "X-HVA-App-Version": MIN_APP_VERSION,
    ...init.headers,
  });
  return new Request(`http://localhost${urlPath}`, {
    method,
    headers,
    body: init.body,
  });
}

function json(method: string, urlPath: string, body: unknown) {
  return request(method, urlPath, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function chunk(
  bytes: Uint8Array<ArrayBuffer>,
  offset: number,
  length = bytes.byteLength,
) {
  return request("PATCH", `/api/app/v1/uploads/${UPLOAD}`, {
    body: bytes,
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(length),
      "upload-offset": String(offset),
    },
  });
}

const uploadContext = { params: Promise.resolve({ id: UPLOAD }) };
const clipContext = { params: Promise.resolve({ id: CLIP }) };

let root: string;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  root = await mkdtemp(path.join(tmpdir(), "upload-routes-"));
  vi.stubEnv("UPLOAD_STAGING_ROOT", root);
  auth.getDeviceSession.mockResolvedValue({
    publicId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    kind: "device",
    coach: { id: COACH, email: "coach@example.test", name: "Coach" },
  });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

describe("POST /api/app/v1/uploads", () => {
  const body = { purpose: "clip", targetId: CLIP, sizeBytes: 24 };

  it("announces an upload and stages its empty file", async () => {
    queries.createClipUpload.mockResolvedValue({
      kind: "created",
      upload: upload(0),
    });

    const response = await postUpload(
      json("POST", "/api/app/v1/uploads", body),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe(
      `/api/app/v1/uploads/${UPLOAD}`,
    );
    expect(response.headers.get("upload-offset")).toBe("0");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(queries.createClipUpload).toHaveBeenCalledWith(
      { purpose: "clip", clipId: CLIP, sizeBytes: 24 },
      COACH,
    );
    expect((await stat(stagingFilePath(root, UPLOAD))).size).toBe(0);
    await expectGoldenPayload("upload-created", await response.json());
  });

  it("refuses a size over the cap before touching the database", async () => {
    const response = await postUpload(
      json("POST", "/api/app/v1/uploads", {
        ...body,
        sizeBytes: MAX_CLIP_UPLOAD_BYTES + 1,
      }),
    );
    expect(response.status).toBe(413);
    expect(queries.createClipUpload).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown clip and 422 for a clip the server cuts", async () => {
    queries.createClipUpload.mockResolvedValueOnce({ kind: "not_found" });
    expect(
      (await postUpload(json("POST", "/api/app/v1/uploads", body))).status,
    ).toBe(404);
    queries.createClipUpload.mockResolvedValueOnce({ kind: "not_mac" });
    expect(
      (await postUpload(json("POST", "/api/app/v1/uploads", body))).status,
    ).toBe(422);
  });

  it("answers 401 without the Mac's token", async () => {
    auth.getDeviceSession.mockResolvedValue(null);
    const response = await postUpload(
      json("POST", "/api/app/v1/uploads", body),
    );
    expect(response.status).toBe(401);
    expect(queries.createClipUpload).not.toHaveBeenCalled();
  });

  it("answers 503 while no staging directory is configured", async () => {
    vi.stubEnv("UPLOAD_STAGING_ROOT", "");
    const response = await postUpload(
      json("POST", "/api/app/v1/uploads", body),
    );
    expect(response.status).toBe(503);
  });
});

describe("PATCH /api/app/v1/uploads/{id}", () => {
  beforeEach(async () => {
    await createStagingFile(root, UPLOAD);
  });

  it("writes a chunk at the offset and answers the new one", async () => {
    queries.readUpload.mockResolvedValue(upload(0));
    queries.advanceUpload.mockResolvedValue(upload(12));

    const response = await patchUpload(chunk(MP4_HEAD, 0), uploadContext);

    expect(response.status).toBe(204);
    expect(response.headers.get("upload-offset")).toBe("12");
    expect(response.headers.get("upload-length")).toBe("24");
    expect(queries.advanceUpload).toHaveBeenCalledWith(UPLOAD, COACH, 0, 12);
    expect(
      new Uint8Array(await readFile(stagingFilePath(root, UPLOAD))),
    ).toEqual(MP4_HEAD);
  });

  it("answers 409 with the server's offset when the Mac is elsewhere", async () => {
    queries.readUpload.mockResolvedValue(upload(12));

    const response = await patchUpload(chunk(MP4_HEAD, 0), uploadContext);

    expect(response.status).toBe(409);
    expect(response.headers.get("upload-offset")).toBe("12");
    expect(queries.advanceUpload).not.toHaveBeenCalled();
    await expectGoldenPayload("upload-offset-conflict", await response.json());
  });

  it("refuses a first chunk that does not open an MP4 file", async () => {
    queries.readUpload.mockResolvedValue(upload(0));

    const response = await patchUpload(
      chunk(new TextEncoder().encode("#!/bin/sh\necho hi\n"), 0),
      uploadContext,
    );

    expect(response.status).toBe(415);
    expect(queries.advanceUpload).not.toHaveBeenCalled();
  });

  it("refuses a chunk over the chunk cap or past the size", async () => {
    queries.readUpload.mockResolvedValue(upload(0));
    const tooBig = await patchUpload(
      chunk(MP4_HEAD, 0, MAX_UPLOAD_CHUNK_BYTES + 1),
      uploadContext,
    );
    expect(tooBig.status).toBe(413);
    expect(queries.readUpload).not.toHaveBeenCalled();

    queries.readUpload.mockResolvedValue(upload(20));
    const past = await patchUpload(chunk(MP4_HEAD, 20), uploadContext);
    expect(past.status).toBe(413);
    expect(queries.advanceUpload).not.toHaveBeenCalled();
  });

  it("keeps only Content-Length bytes of a longer body", async () => {
    queries.readUpload.mockResolvedValue(upload(0));

    const response = await patchUpload(chunk(MP4_HEAD, 0, 8), uploadContext);

    expect(response.status).toBe(400);
    expect(queries.advanceUpload).not.toHaveBeenCalled();
  });

  it("refuses a chunk sent as anything but raw bytes", async () => {
    const response = await patchUpload(
      request("PATCH", `/api/app/v1/uploads/${UPLOAD}`, {
        body: MP4_HEAD,
        headers: {
          "content-type": "multipart/form-data",
          "upload-offset": "0",
        },
      }),
      uploadContext,
    );
    expect(response.status).toBe(415);
  });

  it("answers 404 for another coach's upload", async () => {
    queries.readUpload.mockResolvedValue(null);
    const response = await patchUpload(chunk(MP4_HEAD, 0), uploadContext);
    expect(response.status).toBe(404);
    expect(queries.readUpload).toHaveBeenCalledWith(UPLOAD, COACH);
  });

  it("refuses an id that is not an upload id", async () => {
    const response = await patchUpload(chunk(MP4_HEAD, 0), {
      params: Promise.resolve({ id: "../../clips/x" }),
    });
    expect(response.status).toBe(400);
    expect(queries.readUpload).not.toHaveBeenCalled();
  });
});

describe("HEAD /api/app/v1/uploads/{id}", () => {
  it("answers the offset to resume from", async () => {
    queries.readUpload.mockResolvedValue(upload(12));
    const response = await headUpload(
      request("HEAD", `/api/app/v1/uploads/${UPLOAD}`),
      uploadContext,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("upload-offset")).toBe("12");
    expect(response.headers.get("upload-length")).toBe("24");
    expect(await response.text()).toBe("");
  });

  it("answers 404 without a body for an unknown upload", async () => {
    queries.readUpload.mockResolvedValue(null);
    const response = await headUpload(
      request("HEAD", `/api/app/v1/uploads/${UPLOAD}`),
      uploadContext,
    );
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/app/v1/uploads/{id}", () => {
  it("abandons the upload with its staged bytes", async () => {
    await createStagingFile(root, UPLOAD);
    queries.deleteUpload.mockResolvedValue("deleted");

    const response = await deleteUpload(
      request("DELETE", `/api/app/v1/uploads/${UPLOAD}`),
      uploadContext,
    );

    expect(response.status).toBe(204);
    expect(queries.deleteUpload).toHaveBeenCalledWith(UPLOAD, COACH);
    await expect(stat(stagingFilePath(root, UPLOAD))).rejects.toThrow();
  });

  it("leaves an upload the clip worker holds", async () => {
    await createStagingFile(root, UPLOAD);
    queries.deleteUpload.mockResolvedValue("submitted");

    const response = await deleteUpload(
      request("DELETE", `/api/app/v1/uploads/${UPLOAD}`),
      uploadContext,
    );

    expect(response.status).toBe(409);
    await expect(stat(stagingFilePath(root, UPLOAD))).resolves.toBeTruthy();
  });
});

describe("POST /api/app/v1/clips/{id}/file", () => {
  const body = { uploadId: UPLOAD, tagVersion: 3, cutStartS: 987.5 };

  it("hands the file to the clip worker", async () => {
    queries.handOffClipFile.mockResolvedValue({
      kind: "accepted",
      clipStatus: "processing",
    });

    const response = await postClipFile(
      json("POST", `/api/app/v1/clips/${CLIP}/file`, body),
      clipContext,
    );

    expect(response.status).toBe(202);
    expect(queries.handOffClipFile).toHaveBeenCalledWith(CLIP, body, COACH);
    await expectGoldenPayload("clip-file-accepted", await response.json());
  });

  it("answers 409 with the tag as it is when the tag moved", async () => {
    queries.handOffClipFile.mockResolvedValue({
      kind: "tag_moved",
      tag: { id: TAG, version: 4, type: "goal", startS: 985, endS: 1005 },
    });

    const response = await postClipFile(
      json("POST", `/api/app/v1/clips/${CLIP}/file`, body),
      clipContext,
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("etag")).toBe('"4"');
    await expectGoldenPayload("clip-file-tag-moved", await response.json());
  });

  it.each([
    [{ kind: "not_found" }, 404],
    [{ kind: "upload_not_found" }, 404],
    [{ kind: "not_mac" }, 422],
    [{ kind: "wrong_target" }, 422],
    [{ kind: "bad_cut_start" }, 422],
    [{ kind: "upload_used", status: "done" }, 409],
    [{ kind: "incomplete", receivedBytes: 12 }, 409],
    [{ kind: "clip_busy", clipStatus: "processing" }, 409],
  ])("answers %j with %i", async (outcome, status) => {
    queries.handOffClipFile.mockResolvedValue(outcome);
    const response = await postClipFile(
      json("POST", `/api/app/v1/clips/${CLIP}/file`, body),
      clipContext,
    );
    expect(response.status).toBe(status);
  });

  it("refuses a body without a tag version", async () => {
    const response = await postClipFile(
      json("POST", `/api/app/v1/clips/${CLIP}/file`, {
        uploadId: UPLOAD,
        cutStartS: 987.5,
      }),
      clipContext,
    );
    expect(response.status).toBe(400);
    expect(queries.handOffClipFile).not.toHaveBeenCalled();
  });
});
