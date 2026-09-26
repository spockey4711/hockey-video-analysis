import { beforeEach, describe, expect, it, vi } from "vitest";

// The actions run against mocked auth and queries: what matters here is that
// nothing is stored without a coach session or with an invalid value, and
// that only a validated formation with players reaches the database.
const {
  getCurrentCoach,
  createFormation,
  saveFormation,
  getFormation,
  deleteFormation,
  revalidatePath,
  redirect,
} = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  createFormation: vi.fn(),
  saveFormation: vi.fn(),
  getFormation: vi.fn(),
  deleteFormation: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ getCurrentCoach }));
vi.mock("@/features/tactics/formation-queries", () => ({
  createFormation,
  saveFormation,
  getFormation,
  deleteFormation,
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));

import { tacticsContent } from "@/features/tactics/content";
import { builtInScene, formationFromScene } from "@/features/tactics/formation";
import {
  createFormationAction,
  deleteFormationAction,
  duplicateFormationAction,
  saveFormationAction,
  saveSceneAsFormationAction,
} from "@/features/tactics/formation-actions";
import { defaultScene, newScene } from "@/features/tactics/scene";
import {
  formationFromSceneInitialState,
  sceneMutationInitialState,
  sceneRedirectInitialState,
} from "@/features/tactics/state";

const { errors } = tacticsContent;
const COACH = { id: "coach-1", email: "coach@example.test", name: "Coach" };
const FORMATION_ID = "11111111-1111-4111-8111-111111111111";
const NEW_ID = "22222222-2222-4222-8222-222222222222";
const PLAYER_ID = "44444444-4444-4444-8444-444444444444";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function saveForm(overrides: Record<string, string> = {}): FormData {
  return form({
    formationId: FORMATION_ID,
    name: " Tiefe Abwehr ",
    kind: "defence",
    formation: JSON.stringify(formationFromScene(defaultScene())),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCoach.mockResolvedValue(COACH);
  createFormation.mockResolvedValue({ id: NEW_ID });
  saveFormation.mockResolvedValue(true);
  deleteFormation.mockResolvedValue(true);
});

describe("createFormationAction", () => {
  it.each([
    ["a whole-pitch defence", "full", "defence", defaultScene()],
    ["a whole-pitch attack", "full", "attack", defaultScene()],
    [
      "a short-corner defence",
      "corner",
      "defence",
      builtInScene("corner-defence"),
    ],
    [
      "a short-corner attack",
      "corner",
      "attack",
      builtInScene("corner-attack"),
    ],
  ])(
    "creates %s from the matching start and opens it",
    async (_name, view, kind, start) => {
      await expect(
        createFormationAction(
          sceneRedirectInitialState,
          form({ name: " Tiefe Abwehr ", view, kind }),
        ),
      ).rejects.toThrow(`redirect:/tactics/formations/${NEW_ID}`);
      expect(createFormation).toHaveBeenCalledWith({
        name: "Tiefe Abwehr",
        kind,
        formation: formationFromScene(start),
        createdBy: COACH.id,
      });
    },
  );

  it.each([
    ["an empty name", { name: " " }, errors.invalidName],
    ["an unknown view", { view: "half" }, errors.invalidView],
    ["an unknown kind", { kind: "pressing" }, errors.invalidKind],
  ])("rejects %s", async (_name, fields, error) => {
    expect(
      await createFormationAction(
        sceneRedirectInitialState,
        form({
          name: "Tiefe Abwehr",
          view: "full",
          kind: "defence",
          ...fields,
        }),
      ),
    ).toEqual({ error });
    expect(createFormation).not.toHaveBeenCalled();
  });

  it("rejects a missing session", async () => {
    getCurrentCoach.mockResolvedValue(null);
    expect(
      await createFormationAction(
        sceneRedirectInitialState,
        form({ name: "Tiefe Abwehr", view: "full", kind: "defence" }),
      ),
    ).toEqual({ error: errors.unauthorized });
    expect(createFormation).not.toHaveBeenCalled();
  });
});

describe("saveSceneAsFormationAction", () => {
  it("stores the scene's start arrangement without roster links and stays", async () => {
    const scene = {
      ...defaultScene(),
      tokens: defaultScene().tokens.map((token) =>
        token.id === "p1" ? { ...token, playerId: PLAYER_ID } : token,
      ),
    };
    const result = await saveSceneAsFormationAction(
      formationFromSceneInitialState,
      form({
        name: "Tiefe Abwehr",
        kind: "defence",
        scene: JSON.stringify(scene),
      }),
    );

    expect(result).toEqual({ status: "success", formationId: NEW_ID });
    expect(createFormation).toHaveBeenCalledWith({
      name: "Tiefe Abwehr",
      kind: "defence",
      formation: formationFromScene(defaultScene()),
      createdBy: COACH.id,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a scene without players",
      { scene: JSON.stringify(newScene("corner")) },
      errors.noPlayers,
    ],
    ["a scene that does not parse", { scene: "{" }, errors.invalidScene],
    ["an unknown kind", { kind: "" }, errors.invalidKind],
    ["an empty name", { name: "" }, errors.invalidName],
  ])("rejects %s", async (_name, fields, error) => {
    expect(
      await saveSceneAsFormationAction(
        formationFromSceneInitialState,
        form({
          name: "Tiefe Abwehr",
          kind: "defence",
          scene: JSON.stringify(defaultScene()),
          ...fields,
        }),
      ),
    ).toEqual({ status: "error", error });
    expect(createFormation).not.toHaveBeenCalled();
  });
});

describe("saveFormationAction", () => {
  it("stores the trimmed name, the kind and the validated formation", async () => {
    const result = await saveFormationAction(
      sceneMutationInitialState,
      saveForm({ kind: "attack" }),
    );

    expect(result).toEqual({ status: "success" });
    expect(saveFormation).toHaveBeenCalledWith(FORMATION_ID, {
      name: "Tiefe Abwehr",
      kind: "attack",
      formation: formationFromScene(defaultScene()),
    });
    expect(revalidatePath).toHaveBeenCalledWith(
      `/tactics/formations/${FORMATION_ID}`,
    );
  });

  it.each([
    ["a malformed id", { formationId: "1" }, errors.formationNotFound],
    ["an empty name", { name: "" }, errors.invalidName],
    ["an unknown kind", { kind: "both" }, errors.invalidKind],
    [
      "a scene instead of a formation",
      { formation: JSON.stringify(defaultScene()) },
      errors.invalidFormation,
    ],
    [
      "a formation without players",
      { formation: JSON.stringify(formationFromScene(newScene("corner"))) },
      errors.noPlayers,
    ],
  ])("rejects %s", async (_name, fields, error) => {
    expect(
      await saveFormationAction(sceneMutationInitialState, saveForm(fields)),
    ).toEqual({ status: "error", error });
    expect(saveFormation).not.toHaveBeenCalled();
  });

  it("reports a formation that is gone and a missing session", async () => {
    saveFormation.mockResolvedValue(false);
    expect(
      await saveFormationAction(sceneMutationInitialState, saveForm()),
    ).toEqual({ status: "error", error: errors.formationNotFound });
    getCurrentCoach.mockResolvedValue(null);
    expect(
      await saveFormationAction(sceneMutationInitialState, saveForm()),
    ).toEqual({ status: "error", error: errors.unauthorized });
  });
});

describe("duplicateFormationAction", () => {
  it("copies the stored formation under a copy name and opens it", async () => {
    const formation = formationFromScene(builtInScene("corner-defence"));
    getFormation.mockResolvedValue({
      id: FORMATION_ID,
      name: "Tiefe Abwehr",
      kind: "defence",
      formation,
    });

    await expect(
      duplicateFormationAction(
        sceneRedirectInitialState,
        form({ formationId: FORMATION_ID }),
      ),
    ).rejects.toThrow(`redirect:/tactics/formations/${NEW_ID}`);
    expect(createFormation).toHaveBeenCalledWith({
      name: "Tiefe Abwehr (Kopie)",
      kind: "defence",
      formation,
      createdBy: COACH.id,
    });
  });

  it("reports a formation that is gone", async () => {
    getFormation.mockResolvedValue(null);
    expect(
      await duplicateFormationAction(
        sceneRedirectInitialState,
        form({ formationId: FORMATION_ID }),
      ),
    ).toEqual({ error: errors.formationNotFound });
    expect(createFormation).not.toHaveBeenCalled();
  });
});

describe("deleteFormationAction", () => {
  it("deletes the formation and goes back to the list", async () => {
    await expect(
      deleteFormationAction(
        sceneMutationInitialState,
        form({ formationId: FORMATION_ID }),
      ),
    ).rejects.toThrow("redirect:/tactics");
    expect(deleteFormation).toHaveBeenCalledWith(FORMATION_ID);
  });

  it("reports a malformed id and a formation that is gone", async () => {
    expect(
      await deleteFormationAction(
        sceneMutationInitialState,
        form({ formationId: "x" }),
      ),
    ).toEqual({ status: "error", error: errors.formationNotFound });
    deleteFormation.mockResolvedValue(false);
    expect(
      await deleteFormationAction(
        sceneMutationInitialState,
        form({ formationId: FORMATION_ID }),
      ),
    ).toEqual({ status: "error", error: errors.formationNotFound });
  });
});
