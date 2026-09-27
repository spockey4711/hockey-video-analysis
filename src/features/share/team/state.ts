/**
 * `useActionState` shape for the team link's create/replace form. Kept apart
 * from the `"use server"` action file, which may export only actions. The
 * token itself never travels in it: the page re-renders with the new link.
 */
export interface TeamShareLinkState {
  status: "idle" | "success" | "error";
  error?: string;
}

/** The initial state for the team link form. */
export const teamShareLinkInitialState: TeamShareLinkState = {
  status: "idle",
};
