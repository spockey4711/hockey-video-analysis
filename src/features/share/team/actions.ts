"use server";

import { revalidatePath } from "next/cache";

import { teamShareContent } from "./content";
import type { TeamShareLinkState } from "./state";
import { regenerateTeamShareToken } from "./token";

import { getCurrentCoach } from "@/lib/auth";

const { errors } = teamShareContent.settings;

/**
 * Create the team link, or replace it with a new one (Einstellungen > Teilen).
 * Coach-only. The old link stops working as soon as this commits. The pages
 * that show the link are revalidated so they render the new one; the token is
 * never returned in the form state or logged.
 */
export async function regenerateTeamShareLinkAction(): Promise<TeamShareLinkState> {
  const coach = await getCurrentCoach();
  if (!coach) return { status: "error", error: errors.unauthorized };

  try {
    await regenerateTeamShareToken();
  } catch {
    console.error("failed to create a new team share link");
    return { status: "error", error: errors.unexpected };
  }
  revalidatePath("/settings");
  revalidatePath("/players");
  return { status: "success" };
}
