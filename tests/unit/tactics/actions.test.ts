import { beforeEach, describe, expect, it, vi } from "vitest";

// The actions run against mocked auth and queries: what matters here is that
// nothing is stored without a coach session or with an invalid value, and
// that only a validated scene reaches the database.
const {
  getCurrentCoach,
  createScene,
  saveScene,
  getScene,
  deleteScene,
  getFormation,
  revalidatePath,
  redirect,
} = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  createScene: vi.fn(),
  saveScene: vi.fn(),
  getScene: vi.fn(),
  deleteScene: vi.fn(),
  getFormation: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ getCurrentCoach }));
vi.mock("@/features/tactics/queries", () => ({
  createScene,
  saveScene,
  getScene,
  deleteScene,
}));
vi.mock("@/features/tactics/formation-queries", () => ({ getFormation }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));

import {
  createSceneAction,
  deleteSceneAction,
  duplicateSceneAction,
  saveSceneAction,
} from "@/features/tactics/actions";
import { tacticsContent } from "@/features/tactics/content";
import {
  builtInScene,
  formationFromScene,
  sceneFromFormation,
} from "@/features/tactics/formation";
import {
  defaultScene,
  emptyScene,
  newScene,
  type TacticsScene,
} from "@/features/tactics/scene";
import {
  sceneMutationInitialState,
  sceneRedirectInitialState,
} from "@/features/tactics/state";

const { errors } = tacticsContent;
const COACH = { id: "coach-1", email: "coach@example.test", name: "Coach" };
const SCENE_ID = "11111111-1111-4111-8111-111111111111";
const NEW_ID = "22222222-2222-4222-8222-222222222222";
const FORMATION_ID = "33333333-3333-4333-8333-333333333333";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function saveForm(overrides: Record<string, string> = {}): FormData {
  return form({
    sceneId: SCENE_ID,
    name: " Ecke kurz ",
    scene: JSON.stringify(defaultScene()),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCoach.mockResolvedValue(COACH);
  createScene.mockResolvedValue({ id: NEW_ID });
  saveScene.mockResolvedValue("saved");
  deleteScene.mockResolvedValue(true);
});

describe("createSceneAction", () => {
  it("creates a whole-pitch scene with the default lineup and opens it", async () => {
    await expect(
      createSceneAction(
        sceneRedirectInitialState,
        form({ name: "Pressing", view: "full" }),
      ),
    ).rejects.toThrow(`redirect:/tactics/${NEW_ID}`);
    expect(createScene).toHaveBeenCalledWith({
      name: "Pressing",
      scene: defaultScene(),
      createdBy: COACH.id,
    });
  });

  it("creates a short-corner scene when the coach picks the short corner", async () => {
    await expect(
      createSceneAction(
        sceneRedirectInitialState,
        form({ name: "Ecke kurz", view: "corner" }),
      ),
    ).rejects.toThrow(`redirect:/tactics/${NEW_ID}`);
    expect(createScene).toHaveBeenCalledWith({
      name: "Ecke kurz",
      scene: newScene("corner"),
      createdBy: COACH.id,
    });
  });

  it.each([
    ["the empty pitch", "full", "empty", emptyScene()],
    ["the lineup", "full", "lineup", defaultScene()],
    ["the ball alone", "corner", "ball", newScene("corner")],
    [
      "the corner with the team defending",
      "corner",
      "corner-defence",
      builtInScene("corner-defence"),
    ],
    [
      "the corner with the team attacking",
      "corner",
      "corner-attack",
      builtInScene("corner-attack"),
    ],
  ])("starts from %s", async (_name, view, start, scene) => {
    await expect(
      createSceneAction(
        sceneRedirectInitialState,
        form({ name: "Start", view, start }),
      ),
    ).rejects.toThrow(`redirect:/tactics/${NEW_ID}`);
    expect(createScene).toHaveBeenCalledWith({
      name: "Start",
      scene,
      createdBy: COACH.id,
    });
    expect(getFormation).not.toHaveBeenCalled();
  });

  it.each([
    ["a whole-pitch", defaultScene()],
    ["a short-corner", builtInScene("corner-defence")],
  ])("starts from a copy of %s formation", async (_name, source) => {
    const formation = formationFromScene(source);
    getFormation.mockResolvedValue({
      id: FORMATION_ID,
      name: "Benji",
      kind: "defence",
      formation,
    });

    await expect(
      createSceneAction(
        sceneRedirectInitialState,
        form({ name: "Benji", view: source.view, start: FORMATION_ID }),
      ),
    ).rejects.toThrow(`redirect:/tactics/${NEW_ID}`);
    expect(getFormation).toHaveBeenCalledWith(FORMATION_ID);
    const stored = createScene.mock.calls[0]?.[0] as { scene: TacticsScene };
    expect(stored.scene).toEqual(sceneFromFormation(formation));
    expect(stored.scene.tokens).not.toBe(formation.tokens);
  });

  it("refuses a formation of the other view or one that is gone", async () => {
    getFormation.mockResolvedValue({
      id: FORMATION_ID,
      name: "Benji",
      kind: "defence",
      formation: formationFromScene(defaultScene()),
    });
    expect(
      await createSceneAction(
        sceneRedirectInitialState,
        form({ name: "Ecke", view: "corner", start: FORMATION_ID }),
      ),
    ).toEqual({ error: errors.invalidStart });
    getFormation.mockResolvedValue(null);
    expect(
      await createSceneAction(
        sceneRedirectInitialState,
        form({ name: "Ecke", view: "full", start: FORMATION_ID }),
      ),
    ).toEqual({ error: errors.formationNotFound });
    expect(createScene).not.toHaveBeenCalled();
  });

  it.each([
    ["a start of the other view", "corner-defence"],
    ["an unknown start", "4-4-2"],
    ["an empty start", ""],
  ])("rejects %s", async (_name, start) => {
    expect(
      await createSceneAction(
        sceneRedirectInitialState,
        form({ name: "A", view: "full", start }),
      ),
    ).toEqual({ error: errors.invalidStart });
    expect(getFormation).not.toHaveBeenCalled();
    expect(createScene).not.toHaveBeenCalled();
  });

  it.each([
    ["no view", {}],
    ["a side of the pitch", { view: "corner-right" }],
    ["an unknown view", { view: "half" }],
  ])("rejects %s", async (_name, fields) => {
    expect(
      await createSceneAction(
        sceneRedirectInitialState,
        form({ name: "Ecke", ...fields }),
      ),
    ).toEqual({ error: errors.invalidView });
    expect(createScene).not.toHaveBeenCalled();
  });

  it("rejects an empty name and a missing session", async () => {
    expect(
      await createSceneAction(
        sceneRedirectInitialState,
        form({ name: " ", view: "full" }),
      ),
    ).toEqual({ error: errors.invalidName });
    getCurrentCoach.mockResolvedValue(null);
    expect(
      await createSceneAction(
        sceneRedirectInitialState,
        form({ name: "A", view: "full" }),
      ),
    ).toEqual({ error: errors.unauthorized });
    expect(createScene).not.toHaveBeenCalled();
  });
});

describe("saveSceneAction", () => {
  it("stores the trimmed name and the validated scene", async () => {
    const result = await saveSceneAction(sceneMutationInitialState, saveForm());

    expect(result).toEqual({ status: "success" });
    expect(saveScene).toHaveBeenCalledWith(SCENE_ID, {
      name: "Ecke kurz",
      scene: defaultScene(),
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/tactics/${SCENE_ID}`);
  });

  it.each([
    ["no session", {}, errors.unauthorized, true],
    ["a malformed id", { sceneId: "nope" }, errors.invalidId, false],
    ["an empty name", { name: "" }, errors.invalidName, false],
    ["a scene that is not JSON", { scene: "{" }, errors.invalidScene, false],
    [
      "an invalid scene",
      { scene: JSON.stringify({ ...defaultScene(), version: 9 }) },
      errors.invalidScene,
      false,
    ],
  ])("stores nothing for %s", async (_name, overrides, error, signedOut) => {
    if (signedOut) getCurrentCoach.mockResolvedValue(null);
    const result = await saveSceneAction(
      sceneMutationInitialState,
      saveForm(overrides),
    );
    expect(result).toEqual({ status: "error", error });
    expect(saveScene).not.toHaveBeenCalled();
  });

  it("refuses a scene whose view changed since it was created", async () => {
    saveScene.mockResolvedValueOnce("view-locked");
    expect(
      await saveSceneAction(
        sceneMutationInitialState,
        saveForm({ scene: JSON.stringify(newScene("corner")) }),
      ),
    ).toEqual({ status: "error", error: errors.viewLocked });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports an unknown scene and a failing database", async () => {
    saveScene.mockResolvedValueOnce("not-found");
    expect(
      await saveSceneAction(sceneMutationInitialState, saveForm()),
    ).toEqual({ status: "error", error: errors.notFound });
    saveScene.mockRejectedValueOnce(new Error("down"));
    expect(
      await saveSceneAction(sceneMutationInitialState, saveForm()),
    ).toEqual({ status: "error", error: errors.unexpected });
  });
});

describe("duplicateSceneAction", () => {
  it("copies the stored scene under a copy name and opens the copy", async () => {
    getScene.mockResolvedValue({
      id: SCENE_ID,
      name: "Ecke kurz",
      scene: defaultScene(),
    });
    await expect(
      duplicateSceneAction(
        sceneRedirectInitialState,
        form({ sceneId: SCENE_ID }),
      ),
    ).rejects.toThrow(`redirect:/tactics/${NEW_ID}`);
    expect(createScene).toHaveBeenCalledWith({
      name: "Ecke kurz (Kopie)",
      scene: defaultScene(),
      createdBy: COACH.id,
    });
  });

  it("reports a scene that no longer exists", async () => {
    getScene.mockResolvedValue(null);
    expect(
      await duplicateSceneAction(
        sceneRedirectInitialState,
        form({ sceneId: SCENE_ID }),
      ),
    ).toEqual({ error: errors.notFound });
    expect(createScene).not.toHaveBeenCalled();
  });
});

describe("deleteSceneAction", () => {
  it("deletes the scene and returns to the list", async () => {
    await expect(
      deleteSceneAction(sceneMutationInitialState, form({ sceneId: SCENE_ID })),
    ).rejects.toThrow("redirect:/tactics");
    expect(deleteScene).toHaveBeenCalledWith(SCENE_ID);
  });

  it("deletes nothing without a session or with a malformed id", async () => {
    expect(
      await deleteSceneAction(
        sceneMutationInitialState,
        form({ sceneId: "x" }),
      ),
    ).toEqual({ status: "error", error: errors.invalidId });
    getCurrentCoach.mockResolvedValue(null);
    expect(
      await deleteSceneAction(
        sceneMutationInitialState,
        form({ sceneId: SCENE_ID }),
      ),
    ).toEqual({ status: "error", error: errors.unauthorized });
    expect(deleteScene).not.toHaveBeenCalled();
  });
});
