import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  getPickerData: vi.fn(),
  addClipToCollection: vi.fn(),
  createCollection: vi.fn(),
  createCollectionWithClip: vi.fn(),
  listCollections: vi.fn(),
}));

vi.mock("@/features/access", () => ({
  getCurrentCoach: mocks.getCurrentCoach,
}));
vi.mock("@/features/clip-editor/picker/queries", () => ({
  getPickerData: mocks.getPickerData,
}));
vi.mock("@/features/share/collections/queries", () => ({
  addClipToCollection: mocks.addClipToCollection,
  createCollection: mocks.createCollection,
  createCollectionWithClip: mocks.createCollectionWithClip,
  listCollections: mocks.listCollections,
}));

import {
  GET as getClips,
  POST as addClip,
} from "@/app/api/collections/[id]/clips/route";
import {
  GET as getCollections,
  POST as create,
} from "@/app/api/collections/route";

const COLLECTION = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";
const CLIP = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const BASE = "http://localhost/api/collections";

const picker = { clips: [], games: [], tagTypes: [], players: [] };

function context(id = COLLECTION) {
  return { params: Promise.resolve({ id }) };
}

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.getCurrentCoach.mockResolvedValue({ id: "coach-1" });
  mocks.getPickerData.mockResolvedValue(picker);
  mocks.addClipToCollection.mockResolvedValue("added");
  mocks.createCollection.mockResolvedValue({ id: COLLECTION, shareToken: "t" });
  mocks.createCollectionWithClip.mockResolvedValue({
    id: COLLECTION,
    shareToken: "t",
  });
  mocks.listCollections.mockResolvedValue([
    { id: COLLECTION, name: "Standards", shareToken: "secret", clipCount: 2 },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/collections/[id]/clips", () => {
  it("returns the picker for a coach", async () => {
    const response = await getClips(new Request(BASE), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(picker);
    expect(mocks.getPickerData).toHaveBeenCalledWith(COLLECTION);
  });

  it("refuses a visitor without a coach session", async () => {
    mocks.getCurrentCoach.mockResolvedValue(null);
    const response = await getClips(new Request(BASE), context());
    expect(response.status).toBe(401);
    expect(mocks.getPickerData).not.toHaveBeenCalled();
  });

  it("answers a malformed id with 400 and an unknown one with 404", async () => {
    expect((await getClips(new Request(BASE), context("x"))).status).toBe(400);
    mocks.getPickerData.mockResolvedValue(null);
    expect((await getClips(new Request(BASE), context())).status).toBe(404);
  });
});

describe("POST /api/collections/[id]/clips", () => {
  const url = `${BASE}/${COLLECTION}/clips`;

  it("adds the clip", async () => {
    const response = await addClip(post(url, { clipId: CLIP }), context());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ clipId: CLIP });
    expect(mocks.addClipToCollection).toHaveBeenCalledWith(COLLECTION, CLIP);
  });

  it("refuses a clip already in the collection", async () => {
    mocks.addClipToCollection.mockResolvedValue("duplicate");
    const response = await addClip(post(url, { clipId: CLIP }), context());
    expect(response.status).toBe(409);
  });

  it("refuses a clip that is not ready, and an unknown collection", async () => {
    mocks.addClipToCollection.mockResolvedValue("clip-not-ready");
    expect((await addClip(post(url, { clipId: CLIP }), context())).status).toBe(
      422,
    );
    mocks.addClipToCollection.mockResolvedValue("missing");
    expect((await addClip(post(url, { clipId: CLIP }), context())).status).toBe(
      404,
    );
  });

  it("rejects a bad body before any query", async () => {
    expect((await addClip(post(url, "{"), context())).status).toBe(400);
    expect(
      (await addClip(post(url, { clipId: "nope" }), context())).status,
    ).toBe(400);
    expect(
      (await addClip(post(url, { clipId: CLIP }), context("x"))).status,
    ).toBe(400);
    expect(mocks.addClipToCollection).not.toHaveBeenCalled();
  });

  it("refuses a visitor without a coach session", async () => {
    mocks.getCurrentCoach.mockResolvedValue(null);
    const response = await addClip(post(url, { clipId: CLIP }), context());
    expect(response.status).toBe(401);
    expect(mocks.addClipToCollection).not.toHaveBeenCalled();
  });
});

describe("GET /api/collections", () => {
  it("lists the collections without their share tokens", async () => {
    const response = await getCollections();
    expect(await response.json()).toEqual({
      collections: [{ id: COLLECTION, name: "Standards", clipCount: 2 }],
    });
  });

  it("refuses a visitor without a coach session", async () => {
    mocks.getCurrentCoach.mockResolvedValue(null);
    expect((await getCollections()).status).toBe(401);
  });
});

describe("POST /api/collections", () => {
  it("creates an empty collection by the signed-in coach", async () => {
    const response = await create(post(BASE, { name: "  Ecken  " }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: COLLECTION });
    expect(mocks.createCollection).toHaveBeenCalledWith({
      name: "Ecken",
      createdBy: "coach-1",
    });
  });

  it("creates a collection holding a clip", async () => {
    const response = await create(post(BASE, { name: "Ecken", clipId: CLIP }));
    expect(response.status).toBe(201);
    expect(mocks.createCollectionWithClip).toHaveBeenCalledWith({
      name: "Ecken",
      createdBy: "coach-1",
      clipId: CLIP,
    });
  });

  it("creates nothing for a clip that is not ready", async () => {
    mocks.createCollectionWithClip.mockResolvedValue(null);
    const response = await create(post(BASE, { name: "Ecken", clipId: CLIP }));
    expect(response.status).toBe(422);
  });

  it("rejects a bad name or clip id before any query", async () => {
    expect((await create(post(BASE, { name: " " }))).status).toBe(400);
    expect(
      (await create(post(BASE, { name: "Ecken", clipId: 7 }))).status,
    ).toBe(400);
    expect((await create(post(BASE, "["))).status).toBe(400);
    expect(mocks.createCollection).not.toHaveBeenCalled();
    expect(mocks.createCollectionWithClip).not.toHaveBeenCalled();
  });

  it("refuses a visitor without a coach session", async () => {
    mocks.getCurrentCoach.mockResolvedValue(null);
    expect((await create(post(BASE, { name: "Ecken" }))).status).toBe(401);
  });
});
