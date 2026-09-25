import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCoach, getEntryEdit, saveEntryEdit } = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  getEntryEdit: vi.fn(),
  saveEntryEdit: vi.fn(),
}));

vi.mock("@/features/access", () => ({ getCurrentCoach }));
vi.mock("@/features/clip-edits/queries", () => ({
  getEntryEdit,
  saveEntryEdit,
}));

import { GET, PUT } from "@/app/api/collections/[id]/clips/[clipId]/edit/route";
import { EMPTY_EDIT, MAX_EDIT_JSON_LENGTH } from "@/features/clip-edits";

const COLLECTION = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";
const CLIP = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const URL_ = `http://localhost/api/collections/${COLLECTION}/clips/${CLIP}/edit`;

const entry = {
  edit: null,
  version: 2,
  window: { startS: 100, endS: 112 },
  cutStartS: 98.7,
  clipStatus: "ready",
};

const edit = {
  v: 1,
  trim: { startS: 101, endS: 110 },
  slow: [{ startS: 103, endS: 105, rate: 0.5 }],
  zoom: [],
  marks: [],
};

function context(id = COLLECTION, clipId = CLIP) {
  return { params: Promise.resolve({ id, clipId }) };
}

function put(body: unknown): Request {
  return new Request(URL_, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getCurrentCoach.mockResolvedValue({ id: "coach" });
  getEntryEdit.mockResolvedValue(entry);
  saveEntryEdit.mockResolvedValue({ status: "saved", version: 3 });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/collections/[id]/clips/[clipId]/edit", () => {
  it("returns the entry's edit, version, window and file start", async () => {
    const response = await GET(new Request(URL_), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(entry);
    expect(getEntryEdit).toHaveBeenCalledWith(COLLECTION, CLIP);
  });

  it("is for coaches only", async () => {
    getCurrentCoach.mockResolvedValue(null);

    expect((await GET(new Request(URL_), context())).status).toBe(401);
    expect(getEntryEdit).not.toHaveBeenCalled();
  });

  it("refuses malformed ids and answers 404 for a clip not in the collection", async () => {
    expect((await GET(new Request(URL_), context("x"))).status).toBe(400);
    expect(
      (await GET(new Request(URL_), context(COLLECTION, "x"))).status,
    ).toBe(400);
    getEntryEdit.mockResolvedValue(null);
    expect((await GET(new Request(URL_), context())).status).toBe(404);
  });
});

describe("PUT /api/collections/[id]/clips/[clipId]/edit", () => {
  it("saves a valid edit from the version the editor started from", async () => {
    const response = await PUT(put({ version: 2, edit }), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ edit, version: 3 });
    expect(saveEntryEdit).toHaveBeenCalledWith(COLLECTION, CLIP, edit, 2);
  });

  it("clears the edit on null or an empty edit", async () => {
    await PUT(put({ version: 2, edit: null }), context());
    await PUT(put({ version: 3, edit: EMPTY_EDIT }), context());

    expect(saveEntryEdit.mock.calls.map((call) => call[2])).toEqual([
      null,
      null,
    ]);
  });

  it("refuses a save from an older version with the current one", async () => {
    saveEntryEdit.mockResolvedValue({ status: "conflict", version: 5 });

    const response = await PUT(put({ version: 2, edit }), context());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ version: 5 });
  });

  it("refuses an invalid edit without saving", async () => {
    const response = await PUT(
      put({ version: 2, edit: { ...edit, v: 2 } }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "an edit must be version 1",
    });
    expect(saveEntryEdit).not.toHaveBeenCalled();
  });

  it("refuses an edit reaching outside the clip window", async () => {
    const response = await PUT(
      put({ version: 2, edit: { ...edit, trim: { startS: 95, endS: 110 } } }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "the trim reaches outside the clip",
    });
    expect(saveEntryEdit).not.toHaveBeenCalled();
  });

  it("refuses bad JSON, a missing version and an oversized body", async () => {
    expect((await PUT(put("{"), context())).status).toBe(400);
    expect((await PUT(put({ edit }), context())).status).toBe(400);
    expect(
      (await PUT(put("x".repeat(MAX_EDIT_JSON_LENGTH + 2048)), context()))
        .status,
    ).toBe(413);
    expect(saveEntryEdit).not.toHaveBeenCalled();
  });

  it("is for coaches only", async () => {
    getCurrentCoach.mockResolvedValue(null);

    expect((await PUT(put({ version: 2, edit }), context())).status).toBe(401);
    expect(saveEntryEdit).not.toHaveBeenCalled();
  });

  it("answers 404 for a clip not in the collection", async () => {
    getEntryEdit.mockResolvedValue(null);
    expect((await PUT(put({ version: 2, edit }), context())).status).toBe(404);

    getEntryEdit.mockResolvedValue(entry);
    saveEntryEdit.mockResolvedValue({ status: "missing" });
    expect((await PUT(put({ version: 2, edit }), context())).status).toBe(404);
  });
});
