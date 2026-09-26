import { beforeEach, describe, expect, it, vi } from "vitest";

// The action runs against mocked auth and queries: what matters is that
// nothing changes without a coach session or with a malformed form, and that
// each intent reaches its query for this collection only.
const mocks = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  addSceneToCollection: vi.fn(),
  moveSceneEntry: vi.fn(),
  setSceneHold: vi.fn(),
  removeSceneEntry: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentCoach: mocks.getCurrentCoach }));
vi.mock("@/features/access", () => ({ requireCoach: vi.fn() }));
vi.mock("@/features/share/collections/queries", () => ({}));
vi.mock("@/features/share/collections/team-notes", () => ({}));
vi.mock("@/features/share/collections/presenter-notes", () => ({}));
vi.mock("@/features/share/collections/scene-entries", () => ({
  addSceneToCollection: mocks.addSceneToCollection,
  moveSceneEntry: mocks.moveSceneEntry,
  setSceneHold: mocks.setSceneHold,
  removeSceneEntry: mocks.removeSceneEntry,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { sceneEntryAction } from "@/features/share/collections/actions";
import { collectionsContent } from "@/features/share/collections/content";
import { collectionMutationInitialState } from "@/features/share/collections/state";

const { errors } = collectionsContent.coach;
const COACH = { id: "coach-1", email: "coach@example.test", name: "Coach" };
const COLLECTION = "11111111-1111-4111-8111-111111111111";
const SCENE = "22222222-2222-4222-8222-222222222222";
const ENTRY = "33333333-3333-4333-8333-333333333333";

function submit(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return sceneEntryAction(collectionMutationInitialState, data);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentCoach.mockResolvedValue(COACH);
  mocks.addSceneToCollection.mockResolvedValue("added");
  mocks.moveSceneEntry.mockResolvedValue(true);
  mocks.setSceneHold.mockResolvedValue(true);
  mocks.removeSceneEntry.mockResolvedValue(true);
});

describe("sceneEntryAction", () => {
  it("refuses without a coach session before any query", async () => {
    mocks.getCurrentCoach.mockResolvedValue(null);
    const result = await submit({
      collectionId: COLLECTION,
      intent: "add",
      sceneId: SCENE,
    });
    expect(result).toEqual({ status: "error", error: errors.unauthorized });
    expect(mocks.addSceneToCollection).not.toHaveBeenCalled();
  });

  it("rejects a malformed collection, intent or id", async () => {
    expect(
      await submit({ collectionId: "x", intent: "add", sceneId: SCENE }),
    ).toEqual({ status: "error", error: errors.invalidId });
    expect(
      await submit({ collectionId: COLLECTION, intent: "fly", entryId: ENTRY }),
    ).toEqual({ status: "error", error: errors.invalidScene });
    expect(
      await submit({ collectionId: COLLECTION, intent: "up", entryId: "x" }),
    ).toEqual({ status: "error", error: errors.invalidScene });
    expect(mocks.moveSceneEntry).not.toHaveBeenCalled();
  });

  it("adds a scene and refreshes the collection page", async () => {
    const result = await submit({
      collectionId: COLLECTION,
      intent: "add",
      sceneId: SCENE,
    });
    expect(result).toEqual({ status: "success" });
    expect(mocks.addSceneToCollection).toHaveBeenCalledWith(COLLECTION, SCENE);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/collections/${COLLECTION}`,
    );
  });

  it("says why a scene could not be added", async () => {
    mocks.addSceneToCollection.mockResolvedValue("duplicate");
    expect(
      await submit({ collectionId: COLLECTION, intent: "add", sceneId: SCENE }),
    ).toEqual({ status: "error", error: errors.sceneDuplicate });
    mocks.addSceneToCollection.mockResolvedValue("scene-missing");
    expect(
      await submit({ collectionId: COLLECTION, intent: "add", sceneId: SCENE }),
    ).toEqual({ status: "error", error: errors.sceneNotFound });
  });

  it("moves an entry up or down within its collection", async () => {
    await submit({ collectionId: COLLECTION, intent: "down", entryId: ENTRY });
    expect(mocks.moveSceneEntry).toHaveBeenCalledWith(
      COLLECTION,
      ENTRY,
      "down",
    );
  });

  it("sets only an offered hold time", async () => {
    await submit({
      collectionId: COLLECTION,
      intent: "hold",
      entryId: ENTRY,
      holdS: "15",
    });
    expect(mocks.setSceneHold).toHaveBeenCalledWith(COLLECTION, ENTRY, 15);

    const result = await submit({
      collectionId: COLLECTION,
      intent: "hold",
      entryId: ENTRY,
      holdS: "7200",
    });
    expect(result).toEqual({ status: "error", error: errors.invalidScene });
    expect(mocks.setSceneHold).toHaveBeenCalledTimes(1);
  });

  it("removes an entry, and reports one that is gone", async () => {
    await submit({
      collectionId: COLLECTION,
      intent: "remove",
      entryId: ENTRY,
    });
    expect(mocks.removeSceneEntry).toHaveBeenCalledWith(COLLECTION, ENTRY);

    mocks.removeSceneEntry.mockResolvedValue(false);
    expect(
      await submit({
        collectionId: COLLECTION,
        intent: "remove",
        entryId: ENTRY,
      }),
    ).toEqual({ status: "error", error: errors.sceneNotFound });
  });
});
