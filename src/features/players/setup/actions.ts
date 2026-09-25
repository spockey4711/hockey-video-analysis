"use server";

import { revalidatePath } from "next/cache";

import { playerSetupContent } from "./content";
import { createPlayer, updatePlayer } from "./queries";
import type { PlayerFormState } from "./state";
import { validatePlayer, type RawPlayerInput } from "./validation";

import { isValidPlayerId } from "@/features/players/gdpr/validation";
import { getCurrentCoach } from "@/lib/auth";

const { errors } = playerSetupContent;

/** The roster page, re-rendered after a change so the list shows it. */
const ROSTER_PATH = "/players";

function readPlayerFields(formData: FormData): RawPlayerInput {
  return {
    name: String(formData.get("name") ?? ""),
    jerseyNumber: String(formData.get("jerseyNumber") ?? ""),
  };
}

/**
 * Add a player to the roster with a fresh secret share link. Coach-only:
 * managing the roster is part of the private team workspace. The fields are
 * validated before any query runs.
 */
export async function createPlayerAction(
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const coach = await getCurrentCoach();
  if (!coach) return { status: "error", error: errors.unauthorized };

  const result = validatePlayer(readPlayerFields(formData));
  if (!result.ok) return { status: "error", fieldErrors: result.fieldErrors };

  try {
    await createPlayer(result.value);
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  // Refresh the roster inside the action's own response, so the new player's
  // row arrives with the result rather than via a separate client refresh.
  revalidatePath(ROSTER_PATH);
  return { status: "success" };
}

/**
 * Change an existing player's name and jersey number. Coach-only. The player id
 * comes from the form (`playerId`) and is validated with the fields before any
 * query runs; the share token is left untouched, so the player's link keeps
 * working.
 */
export async function updatePlayerAction(
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const coach = await getCurrentCoach();
  if (!coach) return { status: "error", error: errors.unauthorized };

  const playerId = formData.get("playerId");
  if (!isValidPlayerId(playerId)) {
    return { status: "error", error: errors.invalidId };
  }

  const result = validatePlayer(readPlayerFields(formData));
  if (!result.ok) return { status: "error", fieldErrors: result.fieldErrors };

  let updated: boolean;
  try {
    updated = await updatePlayer(playerId, result.value);
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  if (!updated) return { status: "error", error: errors.notFound };
  revalidatePath(ROSTER_PATH);
  return { status: "success" };
}
