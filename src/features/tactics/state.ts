/**
 * `useActionState` shapes for the tactics scene forms, in their own module so
 * the `"use server"` action file exports only actions.
 */

/** Create or duplicate: success redirects to the new scene, so only errors remain. */
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
