/**
 * `useActionState` shape and seed for player erasure (P1-6), kept out of the
 * `"use server"` action module: a server-action file may only export async
 * functions, so the form imports the initial-state object and the state type
 * from here instead. The summary type is a type-only import, so this module
 * carries no `server-only` code into the client bundle.
 */
import type { PlayerDeletionSummary } from "./queries";

/**
 * Shape returned to `useActionState`; the `idle` object is the initial state. On
 * success the deletion summary is returned so the caller can confirm what was
 * removed.
 */
export interface DeletePlayerState {
  status: "idle" | "success" | "error";
  summary?: PlayerDeletionSummary;
  error?: string;
}

/** The initial state a form seeds `useActionState` with. */
export const deletePlayerInitialState: DeletePlayerState = { status: "idle" };
