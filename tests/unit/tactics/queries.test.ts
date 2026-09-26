import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the drizzle chains: every step returns the chain, and awaiting
// it yields the next queued result, so the tests pin what the queries do with
// the stored rows without a database.
const db = vi.hoisted(() => {
  const results: unknown[] = [];
  const updates: unknown[] = [];
  const inserts: unknown[] = [];
  const chain = () => {
    const step: Record<string, unknown> = {};
    for (const method of ["from", "where", "for", "returning", "orderBy"]) {
      step[method] = () => step;
    }
    step.set = (values: unknown) => {
      updates.push(values);
      return step;
    };
    step.values = (values: unknown) => {
      inserts.push(values);
      return step;
    };
    step.then = (resolve: (rows: unknown) => unknown) =>
      Promise.resolve(results.shift() ?? []).then(resolve);
    return step;
  };
  const client = {
    select: vi.fn(chain),
    update: vi.fn(chain),
    insert: vi.fn(chain),
    transaction: vi.fn(
      async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
        run(client),
    ),
  };
  return { results, updates, inserts, client };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import { createScene, listScenes, saveScene } from "@/features/tactics/queries";
import { defaultScene, newScene } from "@/features/tactics/scene";

const SCENE_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  db.results.length = 0;
  db.updates.length = 0;
  db.inserts.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("saveScene", () => {
  it("saves a scene that keeps its view", async () => {
    db.results.push([{ scene: defaultScene() }]);
    const input = { name: "Pressing", scene: defaultScene() };
    expect(await saveScene(SCENE_ID, input)).toBe("saved");
    expect(db.updates).toEqual([input]);
  });

  it("refuses to change the view the scene was created with", async () => {
    db.results.push([{ scene: defaultScene() }]);
    expect(
      await saveScene(SCENE_ID, { name: "Ecke", scene: newScene("corner") }),
    ).toBe("view-locked");
    db.results.push([{ scene: newScene("corner") }]);
    expect(
      await saveScene(SCENE_ID, { name: "Ecke", scene: defaultScene() }),
    ).toBe("view-locked");
    expect(db.updates).toEqual([]);
  });

  it("compares with the stored view as it reads today", async () => {
    // A stored version 3 right short corner reads as the one short corner.
    db.results.push([
      { scene: { ...newScene("corner"), version: 3, view: "corner-right" } },
    ]);
    expect(
      await saveScene(SCENE_ID, { name: "Ecke", scene: newScene("corner") }),
    ).toBe("saved");
  });

  it("reports a scene that does not exist or no longer parses", async () => {
    db.results.push([]);
    expect(
      await saveScene(SCENE_ID, { name: "A", scene: defaultScene() }),
    ).toBe("not-found");
    db.results.push([{ scene: { version: 9 } }]);
    expect(
      await saveScene(SCENE_ID, { name: "A", scene: defaultScene() }),
    ).toBe("not-found");
    expect(db.updates).toEqual([]);
  });
});

describe("saveScene with a grouping", () => {
  it("stores the category and tags beside the document", async () => {
    db.results.push([{ scene: defaultScene() }]);
    const input = {
      name: "Pressing",
      scene: defaultScene(),
      category: "press" as const,
      tags: ["hoch"],
    };
    expect(await saveScene(SCENE_ID, input)).toBe("saved");
    expect(db.updates).toEqual([input]);
  });
});

describe("createScene", () => {
  it("stores the category and tags of the new scene", async () => {
    db.results.push([{ id: SCENE_ID }]);
    const input = {
      name: "Ecke",
      scene: newScene("corner"),
      category: "attack_corner" as const,
      tags: ["Schlenzer"],
      createdBy: "coach-1",
    };
    expect(await createScene(input)).toEqual({ id: SCENE_ID });
    expect(db.inserts).toEqual([input]);
  });
});

describe("listScenes", () => {
  it("reads each scene's view from its document", async () => {
    const updatedAt = new Date("2026-09-01T10:00:00Z");
    const row = { name: "A", category: "other", tags: [], updatedAt };
    db.results.push([
      { ...row, id: "full", view: "full" },
      { ...row, id: "corner", view: "corner" },
      // A version 3 short corner still names its side.
      { ...row, id: "right", view: "corner-right" },
      // Versions 1 and 2 had no view and always showed the whole pitch.
      { ...row, id: "old", view: null },
    ]);
    const scenes = await listScenes();
    expect(scenes.map(({ id, view }) => [id, view])).toEqual([
      ["full", "full"],
      ["corner", "corner"],
      ["right", "corner"],
      ["old", "full"],
    ]);
    expect(scenes[0]).toEqual({ ...row, id: "full", view: "full" });
  });
});
