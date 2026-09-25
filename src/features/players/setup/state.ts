/**
 * `useActionState` shape and seed for adding and editing a player, kept out of
 * the `"use server"` action module: a server-action file may only export async
 * functions, so the forms import the initial-state object and the state type
 * from here instead.
 */
import type { PlayerFieldErrors } from "./validation";

/**
 * Shape returned to `useActionState`; the `idle` object is the initial state.
 * `error` is a form-level message, `fieldErrors` sit under their inputs.
 */
export interface PlayerFormState {
  status: "idle" | "success" | "error";
  error?: string;
  fieldErrors?: PlayerFieldErrors;
}

/** The initial state a form seeds `useActionState` with. */
export const playerFormInitialState: PlayerFormState = { status: "idle" };
