"use server";

import { rotationContent } from "./content";
import { rotatePlayerShareToken } from "./queries";
import type { RotateShareTokenState } from "./state";
import { isValidPlayerId } from "./validation";

import { getCurrentCoach } from "@/lib/auth";

const { errors } = rotationContent;

/**
 * Rotate a player's share token, revoking the currently shared link. Coach-only:
 * managing player links is part of the private team workspace. The player id
 * comes from the form (`playerId`) and is validated before any query runs; a
 * missing player is reported without confirming which ids exist.
 */
export async function rotateShareTokenAction(
  _prev: RotateShareTokenState,
  formData: FormData,
): Promise<RotateShareTokenState> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return { status: "error", error: errors.unauthorized };
  }

  const playerId = formData.get("playerId");
  if (!isValidPlayerId(playerId)) {
    return { status: "error", error: errors.invalidId };
  }

  let rotated: Awaited<ReturnType<typeof rotatePlayerShareToken>>;
  try {
    rotated = await rotatePlayerShareToken(playerId);
  } catch {
    return { status: "error", error: errors.unexpected };
  }

  if (!rotated) {
    return { status: "error", error: errors.notFound };
  }
  return { status: "success", shareToken: rotated.shareToken };
}
