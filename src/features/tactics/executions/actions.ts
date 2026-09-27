"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { SceneMutationState, SceneRedirectState } from "../state";
import { isValidSceneId } from "../validation";

import { executionsContent } from "./content";
import { MAX_LINKS_PER_PICK, parseExecutionOutcome } from "./outcome";
import {
  linkExecutions,
  setExecutionOutcome,
  unlinkExecution,
} from "./queries";

import { getCurrentCoach } from "@/lib/auth";

const { errors } = executionsContent;

/** Refresh every page that shows a scene's executions or their counts. */
function revalidateScene(sceneId: string): void {
  revalidatePath("/tactics");
  revalidatePath(`/tactics/${sceneId}`);
  revalidatePath(`/tactics/${sceneId}/executions`);
}

/**
 * Link the picked tags to a scene as its executions, then go back to the
 * scene. Coach-only; the scene id and every tag id are validated before any
 * query runs, and one bad id rejects the pick. A tag already linked keeps its
 * outcome; a new one starts from `defaultOutcome`.
 */
export async function linkExecutionsAction(
  _prev: SceneRedirectState,
  formData: FormData,
): Promise<SceneRedirectState> {
  if (!(await getCurrentCoach())) return { error: errors.unauthorized };

  const sceneId = formData.get("sceneId");
  const tagIds = formData.getAll("tagId");
  if (!isValidSceneId(sceneId) || !tagIds.every(isValidSceneId)) {
    return { error: errors.invalidId };
  }
  if (tagIds.length === 0) {
    return { error: executionsContent.picker.noneChosen };
  }
  if (tagIds.length > MAX_LINKS_PER_PICK) return { error: errors.tooMany };

  try {
    const added = await linkExecutions(sceneId, [...new Set(tagIds)]);
    if (added === null) return { error: errors.sceneNotFound };
  } catch {
    return { error: errors.unexpected };
  }
  revalidateScene(sceneId);
  // `redirect` throws, so it stays outside the try/catch above.
  redirect(`/tactics/${sceneId}`);
}

/**
 * Rate one execution (`intent=outcome`) or unlink it (`intent=unlink`).
 * Coach-only; the ids and the outcome are validated before any query runs.
 */
export async function executionAction(
  _prev: SceneMutationState,
  formData: FormData,
): Promise<SceneMutationState> {
  if (!(await getCurrentCoach())) {
    return { status: "error", error: errors.unauthorized };
  }

  const sceneId = formData.get("sceneId");
  const tagId = formData.get("tagId");
  if (!isValidSceneId(sceneId) || !isValidSceneId(tagId)) {
    return { status: "error", error: errors.invalidId };
  }
  const intent = formData.get("intent");

  let done: boolean;
  try {
    if (intent === "outcome") {
      const outcome = parseExecutionOutcome(formData.get("outcome"));
      if (outcome === null) {
        return { status: "error", error: errors.invalidOutcome };
      }
      done = await setExecutionOutcome(sceneId, tagId, outcome);
    } else if (intent === "unlink") {
      done = await unlinkExecution(sceneId, tagId);
    } else {
      return { status: "error", error: errors.unexpected };
    }
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  revalidateScene(sceneId);
  return done
    ? { status: "success" }
    : { status: "error", error: errors.notLinked };
}
