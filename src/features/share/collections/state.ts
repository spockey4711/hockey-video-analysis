/**
 * `useActionState` shapes for the collection curation forms (P2-13). Kept in
 * their own module so the `"use server"` action file exports only actions (a
 * Server Action file may not re-export plain values) and the client forms import
 * the types from here.
 */

/** Create-collection form state; a successful create redirects, so it only carries errors. */
export interface CreateCollectionState {
  error?: string;
}

/** The initial state for the create form. */
export const createCollectionInitialState: CreateCollectionState = {};

/** Shared state for the in-place mutations (save, rotate); success stays on the page. */
export interface CollectionMutationState {
  status: "idle" | "success" | "error";
  error?: string;
}

/** The initial state for an in-place mutation form. */
export const collectionMutationInitialState: CollectionMutationState = {
  status: "idle",
};
