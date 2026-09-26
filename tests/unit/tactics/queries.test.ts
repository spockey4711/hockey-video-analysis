import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the drizzle chains: every step returns the chain, and awaiting
// it yields the next queued result, so the tests pin what `saveScene` does with
// the stored row without a database.
const db = vi.hoisted(() => {
  const results: unknown[] = [];
  const updates: unknown[] = [];
  const chain = () => {
    const step: Record<string, unknown> = {};
    for (const method of ["from", "where", "for", "returning"]) {
      step[method] = () => step;
    }
    step.set = (values: unknown) => {
      updates.push(values);
      return step;
    };
    step.then = (resolve: (rows: unknown) => unknown) =>
      Promise.resolve(results.shift() ?? []).then(resolve);
    return step;
  };
  const client = {
    select: vi.fn(chain),
    update: vi.fn(chain),
    transaction: vi.fn(
      async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
        run(client),
    ),
  };
  return { results, updates, client };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import { saveScene } from "@/features/tactics/queries";
import { defaultScene, newScene } from "@/features/tactics/scene";

const SCENE_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  db.results.length = 0;
  db.updates.length = 0;
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
