"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { tacticsContent } from "./content";
import {
  builtInScene,
  formationFromScene,
  parseFormationJson,
  teamCounts,
  type BuiltInStart,
  type TacticsFormation,
} from "./formation";
import {
  createFormation,
  deleteFormation,
  getFormation,
  saveFormation,
} from "./formation-queries";
import { parseSceneJson } from "./scene";
import type {
  FormationFromSceneState,
  SceneMutationState,
  SceneRedirectState,
} from "./state";
import {
  isValidSceneId,
  MAX_SCENE_NAME_LENGTH,
  normalizeSceneName,
  parseFormationKind,
  parseSceneView,
} from "./validation";

import { getCurrentCoach } from "@/lib/auth";

const { errors, editor } = tacticsContent;

/** True when a formation holds at least one player: an empty one starts nothing. */
function hasPlayers(formation: TacticsFormation): boolean {
  const players = teamCounts(formation.tokens);
  return players.home + players.away > 0;
}

/**
 * Create a formation for the whole pitch or the short corner, then open it on
 * the board. It starts from the matching built-in start, which the coach
 * arranges from there: the 1-3-4-3 lineup on the whole pitch, or the standard
 * penalty corner with the coach's team defending or attacking. Coach-only;
 * every value is validated before any query runs.
 */
export async function createFormationAction(
  _prev: SceneRedirectState,
  formData: FormData,
): Promise<SceneRedirectState> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: errors.unauthorized };

  const name = normalizeSceneName(formData.get("name"));
  if (name === null) return { error: errors.invalidName };
  const view = parseSceneView(formData.get("view"));
  if (view === null) return { error: errors.invalidView };
  const kind = parseFormationKind(formData.get("kind"));
  if (kind === null) return { error: errors.invalidKind };

  const start: BuiltInStart =
    view === "full"
      ? "lineup"
      : kind === "defence"
        ? "corner-defence"
        : "corner-attack";
  let created: { id: string };
  try {
    created = await createFormation({
      name,
      kind,
      formation: formationFromScene(builtInScene(start)),
      createdBy: coach.id,
    });
  } catch {
    return { error: errors.unexpected };
  }
  revalidatePath("/tactics");
  redirect(`/tactics/formations/${created.id}`);
}

/**
 * Save a scene's start arrangement as a new formation, from the scene editor.
 * The scene arrives as the board holds it, saved or not, and passes the scene
 * parser; only its view and start tokens are kept, without roster links. The
 * coach stays on the scene, so unsaved edits there are not lost.
 */
export async function saveSceneAsFormationAction(
  _prev: FormationFromSceneState,
  formData: FormData,
): Promise<FormationFromSceneState> {
  const coach = await getCurrentCoach();
  if (!coach) return { status: "error", error: errors.unauthorized };

  const name = normalizeSceneName(formData.get("name"));
  if (name === null) return { status: "error", error: errors.invalidName };
  const kind = parseFormationKind(formData.get("kind"));
  if (kind === null) return { status: "error", error: errors.invalidKind };
  const scene = parseSceneJson(formData.get("scene"));
  if (scene === null) return { status: "error", error: errors.invalidScene };
  const formation = formationFromScene(scene);
  if (!hasPlayers(formation))
    return { status: "error", error: errors.noPlayers };

  let created: { id: string };
  try {
    created = await createFormation({
      name,
      kind,
      formation,
      createdBy: coach.id,
    });
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  revalidatePath("/tactics");
  return { status: "success", formationId: created.id };
}

/**
 * Save a formation's name, kind and positions. Coach-only. The id, name, kind
 * and the whole formation JSON are validated before any query runs, and a
 * formation without players is refused.
 */
export async function saveFormationAction(
  _prev: SceneMutationState,
  formData: FormData,
): Promise<SceneMutationState> {
  const coach = await getCurrentCoach();
  if (!coach) return { status: "error", error: errors.unauthorized };

  const formationId = formData.get("formationId");
  if (!isValidSceneId(formationId))
    return { status: "error", error: errors.formationNotFound };
  const name = normalizeSceneName(formData.get("name"));
  if (name === null) return { status: "error", error: errors.invalidName };
  const kind = parseFormationKind(formData.get("kind"));
  if (kind === null) return { status: "error", error: errors.invalidKind };
  const formation = parseFormationJson(formData.get("formation"));
  if (formation === null)
    return { status: "error", error: errors.invalidFormation };
  if (!hasPlayers(formation))
    return { status: "error", error: errors.noPlayers };

  let saved: boolean;
  try {
    saved = await saveFormation(formationId, { name, kind, formation });
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  if (!saved) return { status: "error", error: errors.formationNotFound };

  revalidatePath("/tactics");
  revalidatePath(`/tactics/formations/${formationId}`);
  return { status: "success" };
}

/**
 * Copy a stored formation under "<name> (Kopie)" and open the copy.
 * Coach-only. The copy is made from what is stored, like a scene's.
 */
export async function duplicateFormationAction(
  _prev: SceneRedirectState,
  formData: FormData,
): Promise<SceneRedirectState> {
  const coach = await getCurrentCoach();
  if (!coach) return { error: errors.unauthorized };

  const formationId = formData.get("formationId");
  if (!isValidSceneId(formationId)) return { error: errors.formationNotFound };

  let created: { id: string };
  try {
    const original = await getFormation(formationId);
    if (!original) return { error: errors.formationNotFound };
    created = await createFormation({
      name: editor
        .copyName(original.name)
        .slice(0, MAX_SCENE_NAME_LENGTH)
        .trim(),
      kind: original.kind,
      formation: original.formation,
      createdBy: coach.id,
    });
  } catch {
    return { error: errors.unexpected };
  }
  revalidatePath("/tactics");
  redirect(`/tactics/formations/${created.id}`);
}

/**
 * Delete a formation, then go back to the list. Coach-only. Scenes started
 * from it keep their copy.
 */
export async function deleteFormationAction(
  _prev: SceneMutationState,
  formData: FormData,
): Promise<SceneMutationState> {
  const coach = await getCurrentCoach();
  if (!coach) return { status: "error", error: errors.unauthorized };

  const formationId = formData.get("formationId");
  if (!isValidSceneId(formationId))
    return { status: "error", error: errors.formationNotFound };

  let deleted: boolean;
  try {
    deleted = await deleteFormation(formationId);
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  if (!deleted) return { status: "error", error: errors.formationNotFound };

  revalidatePath("/tactics");
  redirect("/tactics");
}
