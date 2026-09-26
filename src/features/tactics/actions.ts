"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { tacticsContent } from "./content";
import {
  BUILT_IN_STARTS,
  builtInScene,
  isBuiltInStart,
  sceneFromFormation,
} from "./formation";
import { getFormation } from "./formation-queries";
import {
  DEFAULT_SCENE_CATEGORY,
  normalizeSceneTags,
  parseSceneCategory,
} from "./library";
import {
  createScene,
  deleteScene,
  getScene,
  saveScene,
  type SaveSceneResult,
  type SceneGrouping,
} from "./queries";
import { parseSceneJson, type TacticsScene } from "./scene";
import type { SceneMutationState, SceneRedirectState } from "./state";
import {
  isValidSceneId,
  MAX_SCENE_NAME_LENGTH,
  normalizeSceneName,
  parseSceneView,
} from "./validation";

import { getCurrentCoach } from "@/lib/auth";

const { errors, editor } = tacticsContent;

/**
 * Read a scene's category and tags from a form. A field that is not sent is
 * left out, so a save without it keeps what is stored; a field that is sent
 * must be valid.
 */
function readGrouping(
  formData: FormData,
): Partial<SceneGrouping> | { error: string } {
  const grouping: { category?: SceneGrouping["category"]; tags?: string[] } =
    {};
  const category = formData.get("category");
  if (category !== null) {
    const parsed = parseSceneCategory(category);
    if (parsed === null) return { error: errors.invalidCategory };
    grouping.category = parsed;
  }
  const tags = formData.get("tags");
  if (tags !== null) {
    const parsed = normalizeSceneTags(tags);
    if (parsed === null) return { error: errors.invalidTags };
    grouping.tags = parsed;
  }
  return grouping;
}

/**
 * Create a scene showing the whole pitch or the short corner, then open it.
 * It starts from a built-in start of that view (the first when none is sent)
 * or from a copy of a saved formation of the same view, in the sent category
 * ("other" when none is sent). Coach-only; the name, the view, the category
 * and the start are validated before any query runs. The view is fixed from
 * here on: {@link saveSceneAction} refuses to change it.
 */
export async function createSceneAction(
  _prev: SceneRedirectState,
  formData: FormData,
): Promise<SceneRedirectState> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: errors.unauthorized };

  const name = normalizeSceneName(formData.get("name"));
  if (name === null) return { error: errors.invalidName };
  const view = parseSceneView(formData.get("view"));
  if (view === null) return { error: errors.invalidView };
  const grouping = readGrouping(formData);
  if ("error" in grouping) return grouping;
  const start = formData.get("start") ?? BUILT_IN_STARTS[view][0];
  if (!isBuiltInStart(view, start) && !isValidSceneId(start))
    return { error: errors.invalidStart };

  let created: { id: string };
  try {
    let scene: TacticsScene;
    if (isBuiltInStart(view, start)) {
      scene = builtInScene(start);
    } else {
      const formation = await getFormation(start);
      if (!formation) return { error: errors.formationNotFound };
      if (formation.formation.view !== view)
        return { error: errors.invalidStart };
      scene = sceneFromFormation(formation.formation);
    }
    created = await createScene({
      name,
      scene,
      category: grouping.category ?? DEFAULT_SCENE_CATEGORY,
      tags: grouping.tags ?? [],
      createdBy: coach.id,
    });
  } catch {
    return { error: errors.unexpected };
  }
  // `redirect` throws, so it stays outside the try/catch above.
  redirect(`/tactics/${created.id}`);
}

/**
 * Save a scene's name, category, tags and document. Coach-only. The id, the
 * name, the grouping and the whole scene JSON are validated before any query
 * runs; one bad value rejects the save, so nothing is half-stored. A document with another view than the
 * stored one is refused: the view is chosen once, when the scene is created.
 */
export async function saveSceneAction(
  _prev: SceneMutationState,
  formData: FormData,
): Promise<SceneMutationState> {
  const coach = await getCurrentCoach();
  if (!coach) return { status: "error", error: errors.unauthorized };

  const sceneId = formData.get("sceneId");
  if (!isValidSceneId(sceneId)) {
    return { status: "error", error: errors.invalidId };
  }
  const name = normalizeSceneName(formData.get("name"));
  if (name === null) return { status: "error", error: errors.invalidName };
  const grouping = readGrouping(formData);
  if ("error" in grouping) return { status: "error", error: grouping.error };
  const scene = parseSceneJson(formData.get("scene"));
  if (scene === null) return { status: "error", error: errors.invalidScene };

  let saved: SaveSceneResult;
  try {
    saved = await saveScene(sceneId, { name, scene, ...grouping });
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  if (saved === "not-found") return { status: "error", error: errors.notFound };
  if (saved === "view-locked")
    return { status: "error", error: errors.viewLocked };

  revalidatePath("/tactics");
  revalidatePath(`/tactics/${sceneId}`);
  return { status: "success" };
}

/**
 * Copy a stored scene under "<name> (Kopie)", in its category and with its
 * tags, and open the copy. Coach-only.
 * The copy is made from what is stored, so unsaved edits stay with the
 * original's editor.
 */
export async function duplicateSceneAction(
  _prev: SceneRedirectState,
  formData: FormData,
): Promise<SceneRedirectState> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: errors.unauthorized };

  const sceneId = formData.get("sceneId");
  if (!isValidSceneId(sceneId)) return { error: errors.invalidId };

  let created: { id: string };
  try {
    const original = await getScene(sceneId);
    if (!original) return { error: errors.notFound };
    created = await createScene({
      name: editor
        .copyName(original.name)
        .slice(0, MAX_SCENE_NAME_LENGTH)
        .trim(),
      scene: original.scene,
      category: original.category,
      tags: original.tags,
      createdBy: coach.id,
    });
  } catch {
    return { error: errors.unexpected };
  }
  revalidatePath("/tactics");
  redirect(`/tactics/${created.id}`);
}

/** Delete a scene, then go back to the list. Coach-only. */
export async function deleteSceneAction(
  _prev: SceneMutationState,
  formData: FormData,
): Promise<SceneMutationState> {
  const coach = await getCurrentCoach();
  if (!coach) return { status: "error", error: errors.unauthorized };

  const sceneId = formData.get("sceneId");
  if (!isValidSceneId(sceneId)) {
    return { status: "error", error: errors.invalidId };
  }

  let deleted: boolean;
  try {
    deleted = await deleteScene(sceneId);
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  if (!deleted) return { status: "error", error: errors.notFound };

  revalidatePath("/tactics");
  redirect("/tactics");
}
