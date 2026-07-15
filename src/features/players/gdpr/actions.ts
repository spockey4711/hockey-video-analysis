"use server";

import { gdprContent } from "./content";
import { deletePlayerWithData, type PlayerDeletionSummary } from "./queries";
import { isValidPlayerId } from "./validation";

import { getCurrentCoach } from "@/lib/auth";

const { errors } = gdprContent;

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

/**
 * Erase a player and their personal data (GDPR). Coach-only: managing the roster
 * is part of the private team workspace. The player id comes from the form
 * (`playerId`) and is validated before any query runs; a missing player is
 * reported without confirming which ids exist.
 */
export async function deletePlayerAction(
  _prev: DeletePlayerState,
  formData: FormData,
): Promise<DeletePlayerState> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return { status: "error", error: errors.unauthorized };
  }

  const playerId = formData.get("playerId");
  if (!isValidPlayerId(playerId)) {
    return { status: "error", error: errors.invalidId };
  }

  let summary: PlayerDeletionSummary | null;
  try {
    summary = await deletePlayerWithData(playerId);
  } catch {
    return { status: "error", error: errors.unexpected };
  }

  if (!summary) {
    return { status: "error", error: errors.notFound };
  }
  return { status: "success", summary };
}
