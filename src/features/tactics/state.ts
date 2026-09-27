/**
 * `useActionState` shapes for the tactics scene and formation forms, in their
 * own module so the `"use server"` action files export only actions.
 */

/** Create or duplicate: success redirects to the new one, so only errors remain. */
export interface SceneRedirectState {
  error?: string;
}

export const sceneRedirectInitialState: SceneRedirectState = {};

/** Save or delete in place. */
export interface SceneMutationState {
  status: "idle" | "success" | "error";
  error?: string;
}

export const sceneMutationInitialState: SceneMutationState = {
  status: "idle",
};

/** Save a scene's start arrangement as a formation: the new one's id on success. */
export interface FormationFromSceneState {
  status: "idle" | "success" | "error";
  error?: string;
  formationId?: string;
}

export const formationFromSceneInitialState: FormationFromSceneState = {
  status: "idle",
};
