"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { tacticsContent } from "./content";
import { createScene, deleteScene, getScene, saveScene } from "./queries";
import { defaultScene, parseSceneJson } from "./scene";
import type { SceneMutationState, SceneRedirectState } from "./state";
import {
  isValidSceneId,
  MAX_SCENE_NAME_LENGTH,
  normalizeSceneName,
} from "./validation";

import { getCurrentCoach } from "@/lib/auth";

const { errors, editor } = tacticsContent;

/**
 * Create a scene with the default lineup, then open it. Coach-only; the name
 * is validated before any query runs.
 */
export async function createSceneAction(
  _prev: SceneRedirectState,
  formData: FormData,
): Promise<SceneRedirectState> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: errors.unauthorized };

  const name = normalizeSceneName(formData.get("name"));
  if (name === null) return { error: errors.invalidName };

  let created: { id: string };
  try {
    created = await createScene({
      name,
      scene: defaultScene(),
      createdBy: coach.id,
    });
  } catch {
    return { error: errors.unexpected };
  }
  // `redirect` throws, so it stays outside the try/catch above.
  redirect(`/tactics/${created.id}`);
}

/**
 * Save a scene's name and document. Coach-only. The id, the name and the
 * whole scene JSON are validated before any query runs; one bad value rejects
 * the save, so nothing is half-stored.
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
  const scene = parseSceneJson(formData.get("scene"));
  if (scene === null) return { status: "error", error: errors.invalidScene };

  let saved: boolean;
  try {
    saved = await saveScene(sceneId, { name, scene });
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  if (!saved) return { status: "error", error: errors.notFound };

  revalidatePath("/tactics");
  revalidatePath(`/tactics/${sceneId}`);
  return { status: "success" };
}

/**
 * Copy a stored scene under "<name> (Kopie)" and open the copy. Coach-only.
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
