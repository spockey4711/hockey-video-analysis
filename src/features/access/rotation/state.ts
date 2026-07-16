/**
 * `useActionState` shape and seed for share-token rotation (P1-6), kept out of
 * the `"use server"` action module: a server-action file may only export async
 * functions, so the form imports the initial-state object and the state type
 * from here instead.
 */

/**
 * Shape returned to `useActionState`; the `idle` object is the initial state. On
 * success the fresh `shareToken` is returned so the caller can render the new
 * secret link - the old one no longer resolves.
 */
export interface RotateShareTokenState {
  status: "idle" | "success" | "error";
  shareToken?: string;
  error?: string;
}

/** The initial state a form seeds `useActionState` with. */
export const rotateShareTokenInitialState: RotateShareTokenState = {
  status: "idle",
};
